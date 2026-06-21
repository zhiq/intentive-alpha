import { IntentStatus } from "@prisma/client";
import { assertTransition, canTransition, type TransitionMap } from "./machine";

// Intent Object lifecycle:
//   DRAFT -> NEEDS_DETAILS / MARKET_ACTIONABLE / CANCELLED
//   NEEDS_DETAILS <-> MARKET_ACTIONABLE (as fields are completed/invalidated)
//   MARKET_ACTIONABLE -> LIVE / CANCELLED
//   LIVE -> OFFER_READY / EXPIRED / CANCELLED
//   OFFER_READY -> ACCEPTED / EXPIRED / CANCELLED / LIVE (offer withdrawn)
export const INTENT_TRANSITIONS: TransitionMap<IntentStatus> = {
  [IntentStatus.DRAFT]: [
    IntentStatus.NEEDS_DETAILS,
    IntentStatus.MARKET_ACTIONABLE,
    IntentStatus.CANCELLED,
  ],
  [IntentStatus.NEEDS_DETAILS]: [
    IntentStatus.MARKET_ACTIONABLE,
    IntentStatus.DRAFT,
    IntentStatus.CANCELLED,
  ],
  [IntentStatus.MARKET_ACTIONABLE]: [
    IntentStatus.NEEDS_DETAILS,
    IntentStatus.LIVE,
    IntentStatus.CANCELLED,
  ],
  [IntentStatus.LIVE]: [
    IntentStatus.OFFER_READY,
    IntentStatus.EXPIRED,
    IntentStatus.CANCELLED,
  ],
  [IntentStatus.OFFER_READY]: [
    IntentStatus.ACCEPTED,
    IntentStatus.LIVE,
    IntentStatus.EXPIRED,
    IntentStatus.CANCELLED,
  ],
  [IntentStatus.ACCEPTED]: [],
  [IntentStatus.EXPIRED]: [],
  [IntentStatus.CANCELLED]: [],
};

export function assertIntentTransition(
  from: IntentStatus,
  to: IntentStatus,
): void {
  assertTransition("IntentObject", INTENT_TRANSITIONS, from, to);
}

export function canIntentTransition(
  from: IntentStatus,
  to: IntentStatus,
): boolean {
  return canTransition(INTENT_TRANSITIONS, from, to);
}
