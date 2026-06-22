import { FulfillmentMode, IntentStatus } from "@prisma/client";
import type { MandatoryField } from "@/domain/enums";

// Presentation-only mappings for the Intent Card and Missing Details panel.
// Pure data + helpers (no client-only APIs) so both server and client
// components can import them.

export const MANDATORY_FIELD_LABELS: Record<MandatoryField, string> = {
  serviceType: "Service type",
  requestedStartTime: "Preferred time",
  durationMinutes: "Duration",
  location: "Location",
  fulfillmentMode: "Where it happens",
};

export const MANDATORY_FIELD_HINTS: Record<MandatoryField, string> = {
  serviceType: "Which kind of massage you'd like.",
  requestedStartTime: "When you'd like the session to start.",
  durationMinutes: "How long the session should run.",
  location: "Where you are, so we can match nearby providers.",
  fulfillmentMode: "Therapist comes to you, or you visit them.",
};

// Optional "improve your offers" suggestions keyed by the rule's output strings.
export const OPTIONAL_FIELD_LABELS: Record<string, string> = {
  budget: "Budget range",
  therapistGender: "Therapist gender preference",
  pressureStyle: "Pressure / style preference",
};

export const OPTIONAL_FIELD_HINTS: Record<string, string> = {
  budget: "A range helps providers tailor a fair price.",
  therapistGender: "Tell us if you have a preference.",
  pressureStyle: "e.g. firm, gentle, focus on shoulders.",
};

export const FULFILLMENT_MODE_LABELS: Record<FulfillmentMode, string> = {
  [FulfillmentMode.HOME_SERVICE]: "Therapist comes to me",
  [FulfillmentMode.VISIT_PROVIDER]: "I'll visit the provider",
  [FulfillmentMode.EITHER]: "Either works",
  [FulfillmentMode.UNKNOWN]: "Not specified yet",
};

export const INTENT_STATUS_LABELS: Record<IntentStatus, string> = {
  [IntentStatus.DRAFT]: "Draft",
  [IntentStatus.NEEDS_DETAILS]: "Needs details",
  [IntentStatus.MARKET_ACTIONABLE]: "Ready to activate",
  [IntentStatus.LIVE]: "Live",
  [IntentStatus.OFFER_READY]: "Offers ready",
  [IntentStatus.ACCEPTED]: "Accepted",
  [IntentStatus.EXPIRED]: "Expired",
  [IntentStatus.CANCELLED]: "Cancelled",
};

/** Tailwind classes for the status badge, using the app's design tokens. */
export function intentStatusTone(status: IntentStatus): string {
  switch (status) {
    case IntentStatus.MARKET_ACTIONABLE:
      return "bg-accent text-accent-foreground border-transparent";
    case IntentStatus.NEEDS_DETAILS:
      return "bg-warning text-warning-foreground border-transparent";
    case IntentStatus.LIVE:
    case IntentStatus.OFFER_READY:
    case IntentStatus.ACCEPTED:
      return "bg-success text-success-foreground border-transparent";
    case IntentStatus.EXPIRED:
    case IntentStatus.CANCELLED:
      return "bg-muted text-muted-foreground border-transparent";
    default:
      return "bg-secondary text-secondary-foreground border-transparent";
  }
}

/**
 * Whether an intent is still in the pre-activation, editable phase. Only these
 * statuses accept completion edits (mirrors IntentService.applyCompletion).
 */
export function isIntentEditable(status: IntentStatus): boolean {
  return (
    status === IntentStatus.DRAFT ||
    status === IntentStatus.NEEDS_DETAILS ||
    status === IntentStatus.MARKET_ACTIONABLE
  );
}
