import { FulfillmentMode } from "@prisma/client";
import {
  MASSAGE_MANDATORY_FIELDS,
  type MandatoryField,
} from "@/domain/enums";
import type { MissingFieldsResult } from "@/domain/types";
import type { IntentProjection } from "./types";

// Missing-field detection is a DETERMINISTIC business rule, not an AI judgment —
// the market either has the inputs it needs or it does not. Both AI providers
// delegate here so the gate behaves identically regardless of provider.
export function detectMissingFieldsRule(
  intent: IntentProjection,
): MissingFieldsResult {
  const missing: MandatoryField[] = [];

  if (!intent.serviceType) missing.push("serviceType");
  if (!intent.requestedStartTime) missing.push("requestedStartTime");
  if (!intent.durationMinutes) missing.push("durationMinutes");

  const hasLocation =
    !!intent.locationText && intent.locationText.trim().length > 0;
  if (!hasLocation) missing.push("location");

  if (
    !intent.fulfillmentMode ||
    intent.fulfillmentMode === FulfillmentMode.UNKNOWN
  ) {
    missing.push("fulfillmentMode");
  }

  const optionalSuggestions: string[] = [];
  if (intent.budgetMin === null && intent.budgetMax === null) {
    optionalSuggestions.push("budget");
  }
  const prefs = intent.preferences ?? {};
  if (!("therapistGender" in prefs)) {
    optionalSuggestions.push("therapistGender");
  }
  if (!("pressureStyle" in prefs)) {
    optionalSuggestions.push("pressureStyle");
  }

  // Preserve canonical field order for stable UI.
  const ordered = MASSAGE_MANDATORY_FIELDS.filter((f) => missing.includes(f));

  return { missing: ordered, optionalSuggestions };
}
