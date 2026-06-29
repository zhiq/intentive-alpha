import { FulfillmentMode } from "@/domain/enums";
import type { IntentCardData } from "./IntentCard.types";

export const intentCardCopy = {
  headerDescription:
    "Complete only the mandatory blockers needed to activate the market. Optional details live under “Improve your offers” so you can skip them when speed matters.",
  mandatoryEyebrow: "Mandatory to resolve blockers",
  mandatoryTitle: "Required market details",
  mandatoryDescription:
    "These are the only details that can block activation. Missing fields are marked required; already-filled fields are shown for review and correction.",
  optionalEyebrow: "Improve your offers",
  optionalTitle: "Optional matching preferences",
  optionalDescription:
    "These fields can improve price, fit, and timing of offers, but leaving them blank will never block activation.",
  activationBlocked:
    "Resolve mandatory blockers first. Optional offer improvements can wait.",
} as const;

export const fulfillmentModeOptions = [
  [FulfillmentMode.HOME_SERVICE, "Come to me"],
  [FulfillmentMode.VISIT_PROVIDER, "I visit provider"],
  [FulfillmentMode.EITHER, "Either works"],
] as const;

export type MissingFieldKey = IntentCardData["missingFields"][number];

export function missingFieldSet(intent: IntentCardData): Set<MissingFieldKey> {
  return new Set(intent.missingFields);
}

export function isFulfillmentModeUnset(mode: IntentCardData["fulfillmentMode"]) {
  return mode === FulfillmentMode.UNKNOWN;
}

export function fulfillmentModeFormValue(mode: IntentCardData["fulfillmentMode"]) {
  return isFulfillmentModeUnset(mode) ? "" : mode;
}

export function fieldConfidence(intent: IntentCardData, field: string) {
  return intent.confidence.fields?.[field];
}

export function senToRmInput(sen: number | null) {
  return sen === null ? "" : String(sen / 100);
}
