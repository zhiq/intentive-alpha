import Anthropic from "@anthropic-ai/sdk";
import { parsedIntentSchema, type ParsedIntentDTO } from "@/domain/schema/intent";
import {
  suggestedOfferSchema,
  offerBriefSchema,
  offerRankingSchema,
  type SuggestedOfferDTO,
  type OfferBriefDTO,
  type OfferRankingDTO,
} from "@/domain/schema/offer";
import type { MissingFieldsResult } from "@/domain/types";
import { AiOutputError } from "@/domain/errors";
import { logger } from "@/observability/logger";
import { MarketEvent } from "@/observability/events";
import { detectMissingFieldsRule } from "./missingFields";
import type {
  AiProvider,
  AvailabilitySlot,
  IntentProjection,
  OfferProjection,
  PolicyProjection,
  ProviderProjection,
  UserContext,
} from "./types";
import type { z } from "zod";

// Claude-backed AI provider. Active only when a key is present (see factory).
// Every method asks Claude for STRICT JSON, then validates with the same Zod
// schemas the mock uses. AI output never reaches the DB unvalidated; on any
// validation failure we throw AiOutputError so callers can fall back.
//
// Note: deterministic business rules (missing-field detection) are NOT delegated
// to the model — they stay rule-based for identical behavior across providers.
export class ClaudeAiProvider implements AiProvider {
  readonly name = "claude" as const;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async parseIntent(
    rawInput: string,
    context: UserContext,
  ): Promise<ParsedIntentDTO> {
    const system = [
      "You convert a user's messy massage/wellness request into a strict JSON Intent Object.",
      "Resolve relative time against the provided 'now'. Money is integer sen (RM1 = 100 sen).",
      "fulfillmentMode is one of HOME_SERVICE, VISIT_PROVIDER, EITHER, UNKNOWN. Use UNKNOWN if unclear.",
      "Only infer what is supported by the text or the provided user context; never invent specifics.",
      "Respond with ONLY a JSON object, no prose, no markdown.",
    ].join(" ");
    const user = JSON.stringify({
      rawInput,
      now: context.now.toISOString(),
      timezone: context.timezone,
      passport: context.passport ?? null,
      relationship: context.relationship ?? null,
      shape: PARSE_SHAPE_HINT,
    });
    return this.complete(system, user, parsedIntentSchema, "parseIntent");
  }

  async detectMissingFields(
    intent: IntentProjection,
  ): Promise<MissingFieldsResult> {
    // Deterministic rule, identical to mock.
    return detectMissingFieldsRule(intent);
  }

  async generateProviderOffer(input: {
    intent: IntentProjection;
    provider: ProviderProjection;
    policy: PolicyProjection;
    slot: AvailabilitySlot;
  }): Promise<SuggestedOfferDTO> {
    const system = [
      "You are the Provider Offer Autopilot. Draft ONE structured offer in strict JSON.",
      "Respect policy: never price below minPrice; default to standardPrice;",
      "if a same-day idle slot and add-ons are allowed, prefer adding value over discounting;",
      "apply deposit if the policy requires it; include the cancellation policy text.",
      "Write a concise reasonedBrief explaining the offer. Respond with ONLY JSON.",
    ].join(" ");
    const user = JSON.stringify(input);
    return this.complete(
      system,
      user,
      suggestedOfferSchema,
      "generateProviderOffer",
    );
  }

  async generateOfferBrief(input: {
    intent: IntentProjection;
    offer: SuggestedOfferDTO;
    provider: ProviderProjection;
  }): Promise<OfferBriefDTO> {
    const system =
      "Write a concise, honest Reasoned Offer Brief for this offer. Respond with ONLY JSON: {\"reasonedBrief\": string}.";
    return this.complete(
      system,
      JSON.stringify(input),
      offerBriefSchema,
      "generateOfferBrief",
    );
  }

  async rankOffers(input: {
    intent: IntentProjection;
    offers: OfferProjection[];
  }): Promise<OfferRankingDTO> {
    const system = [
      "Score each offer on fit, value, convenience, risk (each 0..1).",
      "Return ONLY JSON: {\"scores\":[{offerId,fitScore,valueScore,convenienceScore,riskScore}]}.",
    ].join(" ");
    return this.complete(
      system,
      JSON.stringify(input),
      offerRankingSchema,
      "rankOffers",
    );
  }

  async generateUserFriendlyClarification(
    intent: IntentProjection,
    missing: MissingFieldsResult,
  ): Promise<{ message: string }> {
    const system =
      "Write one friendly sentence asking the user for the listed missing details. Respond with ONLY JSON: {\"message\": string}.";
    const schema = offerBriefSchema; // not used; we parse message manually
    void schema;
    const raw = await this.rawComplete(
      system,
      JSON.stringify({ intent, missing }),
    );
    try {
      const parsed = JSON.parse(extractJson(raw)) as { message?: unknown };
      if (typeof parsed.message === "string") return { message: parsed.message };
    } catch {
      // fall through
    }
    return { message: "Please complete the remaining details to continue." };
  }

  private async complete<S extends z.ZodTypeAny>(
    system: string,
    user: string,
    schema: S,
    op: string,
  ): Promise<z.infer<S>> {
    const raw = await this.rawComplete(system, user);
    let json: unknown;
    try {
      json = JSON.parse(extractJson(raw));
    } catch {
      logger.event(MarketEvent.VALIDATION_FAILURE, { op, reason: "non_json" });
      throw new AiOutputError(`Claude returned non-JSON for ${op}`);
    }
    const result = schema.safeParse(json);
    if (!result.success) {
      logger.event(MarketEvent.VALIDATION_FAILURE, {
        op,
        issues: result.error.issues.map((i) => i.path.join(".")),
      });
      throw new AiOutputError(`Claude output failed validation for ${op}`, {
        op,
      });
    }
    return result.data;
  }

  private async rawComplete(system: string, user: string): Promise<string> {
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = resp.content.find((c) => c.type === "text");
    return block && block.type === "text" ? block.text : "";
  }
}

const PARSE_SHAPE_HINT = {
  category: "string",
  serviceType: "string|null",
  desiredOutcome: "string|null",
  requestedStartTime: "ISO8601|null",
  requestedEndTime: "ISO8601|null",
  durationMinutes: "int|null",
  locationText: "string|null",
  fulfillmentMode: "HOME_SERVICE|VISIT_PROVIDER|EITHER|UNKNOWN",
  budgetMin: "sen int|null",
  budgetMax: "sen int|null",
  urgency: "SAME_DAY|TODAY|THIS_WEEK|FLEXIBLE|null",
  preferences: "{ therapistGender?, pressureStyle?, avoidPreferences?[], serviceStyles?[] }",
  confidence: "{ overall: 0..1, fields: {field:0..1}, ambiguityNotes: string[] }",
};

/** Pull a JSON object out of a possibly-fenced model response. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1]!.trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1);
  }
  return text.trim();
}
