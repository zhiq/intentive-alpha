import type { IntentObject } from "@prisma/client";
import { detectMissingFieldsRule } from "@/ai/missingFields";
import { toIntentProjection } from "./projections";
import type { MissingFieldsResult } from "@/domain/types";

// Thin wrapper over the deterministic missing-field rule, operating on a
// persisted IntentObject. Used by the activation gate and the Intent Card UI.
export const MissingFieldService = {
  detect(intent: IntentObject): MissingFieldsResult {
    return detectMissingFieldsRule(toIntentProjection(intent));
  },

  isMarketActionable(intent: IntentObject): boolean {
    return detectMissingFieldsRule(toIntentProjection(intent)).missing.length === 0;
  },
};
