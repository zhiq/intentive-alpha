import { IntentStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { intentCompletionSchema } from "@/domain/schema/intent";
import { ValidationError, NotFoundError, ForbiddenError } from "@/domain/errors";
import { assertIntentTransition } from "@/domain/state/intent";
import { detectMissingFieldsRule } from "@/ai/missingFields";
import { toIntentProjection } from "./projections";
import { MissingFieldService } from "./MissingFieldService";
import { MarketTraceService } from "./MarketTraceService";
import { MarketEvent } from "@/observability/events";

// Owns Intent Object reads, the structured completion step, and status changes
// driven by data completeness. All status changes go through the state machine.
export const IntentService = {
  async getOwned(intentId: string, userId: string) {
    const intent = await prisma.intentObject.findUnique({
      where: { id: intentId },
    });
    if (!intent) throw new NotFoundError("IntentObject", intentId);
    if (intent.userId !== userId) throw new ForbiddenError();
    return intent;
  },

  async listForUser(userId: string) {
    return prisma.intentObject.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Apply the structured completion form to an Intent Object, then recompute
   * whether it is market-actionable and transition NEEDS_DETAILS <->
   * MARKET_ACTIONABLE accordingly. Only mandatory blockers move that gate.
   */
  async applyCompletion(
    intentId: string,
    userId: string,
    input: unknown,
  ) {
    const parsed = intentCompletionSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Invalid completion form", {
        issues: parsed.error.issues,
      });
    }
    const intent = await this.getOwned(intentId, userId);
    if (
      intent.status !== IntentStatus.DRAFT &&
      intent.status !== IntentStatus.NEEDS_DETAILS &&
      intent.status !== IntentStatus.MARKET_ACTIONABLE
    ) {
      throw new ValidationError(
        `Cannot edit an intent in status ${intent.status}`,
      );
    }
    const c = parsed.data;

    const mergedPreferences = mergePreferences(
      intent.preferencesJson as Record<string, unknown>,
      c.preferences ?? {},
    );

    const data: Prisma.IntentObjectUpdateInput = {
      serviceType: valueOrExisting(c, "serviceType", intent.serviceType),
      requestedStartTime: hasOwn(c, "requestedStartTime")
        ? c.requestedStartTime
          ? new Date(c.requestedStartTime)
          : null
        : intent.requestedStartTime,
      durationMinutes: valueOrExisting(
        c,
        "durationMinutes",
        intent.durationMinutes,
      ),
      locationText: c.useCurrentLocation
        ? (c.locationText ?? "Current location")
        : valueOrExisting(c, "locationText", intent.locationText),
      latitude: valueOrExisting(c, "latitude", intent.latitude),
      longitude: valueOrExisting(c, "longitude", intent.longitude),
      fulfillmentMode: c.fulfillmentMode ?? intent.fulfillmentMode,
      budgetMin: valueOrExisting(c, "budgetMin", intent.budgetMin),
      budgetMax: valueOrExisting(c, "budgetMax", intent.budgetMax),
      travelRadiusKm: valueOrExisting(
        c,
        "travelRadiusKm",
        intent.travelRadiusKm,
      ),
      flexibilityTimeMinutes: valueOrExisting(
        c,
        "flexibilityTimeMinutes",
        intent.flexibilityTimeMinutes,
      ),
      flexibilityBudgetPercent: valueOrExisting(
        c,
        "flexibilityBudgetPercent",
        intent.flexibilityBudgetPercent,
      ),
      flexibilityTravelKm: valueOrExisting(
        c,
        "flexibilityTravelKm",
        intent.flexibilityTravelKm,
      ),
      preferencesJson: mergedPreferences as Prisma.InputJsonValue,
    };

    // Recompute end time when start/duration change.
    const start = data.requestedStartTime as Date | null | undefined;
    const duration = (data.durationMinutes as number | null | undefined) ?? null;
    if (start && duration) {
      data.requestedEndTime = new Date(start.getTime() + duration * 60_000);
    } else if (
      hasOwn(c, "requestedStartTime") ||
      hasOwn(c, "durationMinutes")
    ) {
      data.requestedEndTime = null;
    }

    const updated = await prisma.intentObject.update({
      where: { id: intentId },
      data,
    });

    return this.refreshActionability(updated.id, userId);
  },

  /**
   * Recompute missing fields and move the intent to the correct gate status.
   * Idempotent; safe to call after any edit.
   */
  async refreshActionability(intentId: string, userId: string) {
    const intent = await this.getOwned(intentId, userId);
    // Only meaningful before going live.
    if (
      intent.status !== IntentStatus.DRAFT &&
      intent.status !== IntentStatus.NEEDS_DETAILS &&
      intent.status !== IntentStatus.MARKET_ACTIONABLE
    ) {
      return intent;
    }

    const missing = detectMissingFieldsRule(toIntentProjection(intent));
    const target =
      missing.missing.length === 0
        ? IntentStatus.MARKET_ACTIONABLE
        : IntentStatus.NEEDS_DETAILS;

    if (target === intent.status) {
      // Keep missingFieldsJson fresh even if status unchanged.
      return prisma.intentObject.update({
        where: { id: intentId },
        data: { missingFieldsJson: missing.missing as Prisma.InputJsonValue },
      });
    }

    assertIntentTransition(intent.status, target);
    const updated = await prisma.intentObject.update({
      where: { id: intentId },
      data: {
        status: target,
        missingFieldsJson: missing.missing as Prisma.InputJsonValue,
      },
    });

    if (target === IntentStatus.MARKET_ACTIONABLE) {
      await MarketTraceService.record(
        MarketEvent.INTENT_MARKET_ACTIONABLE,
        {},
        { intentObjectId: intentId },
      );
    } else {
      await MarketTraceService.record(
        MarketEvent.MISSING_FIELDS_DETECTED,
        { missing: missing.missing },
        { intentObjectId: intentId },
      );
    }
    return updated;
  },

  async cancel(intentId: string, userId: string) {
    const intent = await this.getOwned(intentId, userId);
    assertIntentTransition(intent.status, IntentStatus.CANCELLED);
    const updated = await prisma.intentObject.update({
      where: { id: intentId },
      data: { status: IntentStatus.CANCELLED },
    });
    await MarketTraceService.record(
      MarketEvent.REQUEST_CANCELLED,
      { by: "user" },
      { intentObjectId: intentId },
    );
    return updated;
  },

  missingFields(intentId: string, userId: string) {
    return this.getOwned(intentId, userId).then((i) =>
      MissingFieldService.detect(i),
    );
  },
};

function hasOwn<T extends object, K extends PropertyKey>(
  object: T,
  key: K,
): object is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function valueOrExisting<T extends object, K extends PropertyKey, V>(
  object: T,
  key: K,
  existing: V,
): V | null {
  return hasOwn(object, key) ? (object[key] as V | null) : existing;
}

function mergePreferences(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  return merged;
}
