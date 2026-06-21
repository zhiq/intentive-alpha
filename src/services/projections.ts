import type { IntentObject } from "@prisma/client";
import type { IntentProjection } from "@/ai/types";

// Maps a persisted IntentObject to the plain projection the AI layer consumes.
// Centralizing this keeps AI decoupled from Prisma row shapes.
export function toIntentProjection(intent: IntentObject): IntentProjection {
  return {
    rawInput: intent.rawInput,
    category: intent.category,
    serviceType: intent.serviceType,
    requestedStartTime: intent.requestedStartTime?.toISOString() ?? null,
    requestedEndTime: intent.requestedEndTime?.toISOString() ?? null,
    durationMinutes: intent.durationMinutes,
    locationText: intent.locationText,
    fulfillmentMode: intent.fulfillmentMode,
    budgetMin: intent.budgetMin,
    budgetMax: intent.budgetMax,
    preferences: (intent.preferencesJson as Record<string, unknown>) ?? {},
  };
}
