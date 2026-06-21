import { LiveIntentStatus } from "@prisma/client";
import { assertTransition, canTransition, type TransitionMap } from "./machine";

// Live Intent lifecycle:
//   ACTIVE -> PAUSED / EXPIRED / FULFILLED / CANCELLED
//   PAUSED -> ACTIVE / EXPIRED / CANCELLED
export const LIVE_INTENT_TRANSITIONS: TransitionMap<LiveIntentStatus> = {
  [LiveIntentStatus.ACTIVE]: [
    LiveIntentStatus.PAUSED,
    LiveIntentStatus.EXPIRED,
    LiveIntentStatus.FULFILLED,
    LiveIntentStatus.CANCELLED,
  ],
  [LiveIntentStatus.PAUSED]: [
    LiveIntentStatus.ACTIVE,
    LiveIntentStatus.EXPIRED,
    LiveIntentStatus.CANCELLED,
  ],
  [LiveIntentStatus.EXPIRED]: [],
  [LiveIntentStatus.FULFILLED]: [],
  [LiveIntentStatus.CANCELLED]: [],
};

export function assertLiveIntentTransition(
  from: LiveIntentStatus,
  to: LiveIntentStatus,
): void {
  assertTransition("LiveIntent", LIVE_INTENT_TRANSITIONS, from, to);
}

export function canLiveIntentTransition(
  from: LiveIntentStatus,
  to: LiveIntentStatus,
): boolean {
  return canTransition(LIVE_INTENT_TRANSITIONS, from, to);
}
