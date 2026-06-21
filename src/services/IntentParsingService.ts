import { IntentStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAiProvider, withAiFallback } from "@/ai";
import type { UserContext } from "@/ai/types";
import { parsedIntentSchema } from "@/domain/schema/intent";
import { ValidationError } from "@/domain/errors";
import {
  ALPHA_CATEGORY,
  DEFAULT_INTENT_TTL_MINUTES,
} from "@/domain/enums";
import { detectMissingFieldsRule } from "@/ai/missingFields";
import { MarketTraceService } from "./MarketTraceService";
import { MarketEvent } from "@/observability/events";

// Builds a UserContext from the user's passport and most recent relationship so
// the parser can resolve relative time and apply non-conflicting defaults.
async function buildUserContext(userId: string): Promise<UserContext> {
  const passport = await prisma.preferencePassport.findUnique({
    where: { userId },
  });
  const relationship = await prisma.relationshipAsset.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  return {
    now: new Date(),
    timezone: "Asia/Kuala_Lumpur",
    passport: passport
      ? {
          preferredAreas: passport.preferredAreas,
          preferredBudgetMin: passport.preferredBudgetMin,
          preferredBudgetMax: passport.preferredBudgetMax,
          preferredServiceStyles: passport.preferredServiceStyles,
          avoidPreferences: passport.avoidPreferences,
          preferredProviderGender: passport.preferredProviderGender,
          defaultTravelRadiusKm: passport.defaultTravelRadiusKm,
          preferredFulfillmentMode: passport.preferredFulfillmentMode,
        }
      : undefined,
    relationship: relationship
      ? {
          providerId: relationship.providerId,
          usualServiceType: relationship.usualServiceType,
          usualDurationMinutes: relationship.usualDurationMinutes,
          usualBudgetMin: relationship.usualBudgetMin,
          usualBudgetMax: relationship.usualBudgetMax,
        }
      : null,
  };
}

export const IntentParsingService = {
  /**
   * Parse raw user input into a persisted IntentObject (DRAFT or NEEDS_DETAILS).
   * AI output is validated with Zod before any write. AI never touches the DB.
   */
  async parseAndCreate(userId: string, rawInput: string) {
    const context = await buildUserContext(userId);

    const parsed = await withAiFallback("parseIntent", (p) =>
      p.parseIntent(rawInput, context),
    );

    // Defense in depth: validate again even though providers validate internally.
    const result = parsedIntentSchema.safeParse(parsed);
    if (!result.success) {
      await MarketTraceService.record(MarketEvent.VALIDATION_FAILURE, {
        op: "parseIntent",
        issues: result.error.issues.map((i) => i.path.join(".")),
      });
      throw new ValidationError("Parsed intent failed validation");
    }
    const data = result.data;

    const projection = {
      rawInput,
      category: data.category || ALPHA_CATEGORY,
      serviceType: data.serviceType,
      requestedStartTime: data.requestedStartTime,
      requestedEndTime: data.requestedEndTime,
      durationMinutes: data.durationMinutes,
      locationText: data.locationText,
      fulfillmentMode: data.fulfillmentMode,
      budgetMin: data.budgetMin,
      budgetMax: data.budgetMax,
      preferences: data.preferences as Record<string, unknown>,
    };
    const missing = detectMissingFieldsRule(projection);
    const status =
      missing.missing.length === 0
        ? IntentStatus.MARKET_ACTIONABLE
        : IntentStatus.NEEDS_DETAILS;

    const expiresAt = new Date(
      Date.now() + DEFAULT_INTENT_TTL_MINUTES * 60_000,
    );

    const intent = await prisma.intentObject.create({
      data: {
        userId,
        rawInput,
        category: data.category || ALPHA_CATEGORY,
        serviceType: data.serviceType,
        desiredOutcome: data.desiredOutcome,
        requestedStartTime: data.requestedStartTime
          ? new Date(data.requestedStartTime)
          : null,
        requestedEndTime: data.requestedEndTime
          ? new Date(data.requestedEndTime)
          : null,
        durationMinutes: data.durationMinutes,
        locationText: data.locationText,
        fulfillmentMode: data.fulfillmentMode,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        urgency: data.urgency,
        preferencesJson: data.preferences as Prisma.InputJsonValue,
        missingFieldsJson: missing.missing as Prisma.InputJsonValue,
        confidenceJson: data.confidence as Prisma.InputJsonValue,
        status,
        expiresAt,
      },
    });

    await MarketTraceService.record(
      MarketEvent.INTENT_PARSED,
      {
        provider: getAiProvider().name,
        serviceType: data.serviceType,
        confidence: data.confidence.overall,
      },
      { intentObjectId: intent.id },
    );
    if (missing.missing.length > 0) {
      await MarketTraceService.record(
        MarketEvent.MISSING_FIELDS_DETECTED,
        { missing: missing.missing },
        { intentObjectId: intent.id },
      );
    } else {
      await MarketTraceService.record(
        MarketEvent.INTENT_MARKET_ACTIONABLE,
        {},
        { intentObjectId: intent.id },
      );
    }

    return { intent, missing, confidence: data.confidence };
  },

  buildUserContext,
};
