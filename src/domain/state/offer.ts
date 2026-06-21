import { OfferStatus } from "@prisma/client";
import { assertTransition, canTransition, type TransitionMap } from "./machine";

// Offer Object lifecycle:
//   SUGGESTED -> APPROVED / EDITED / DECLINED   (provider triage)
//   APPROVED/EDITED -> SENT / DECLINED
//   SENT -> ACCEPTED / REJECTED / EXPIRED       (user decision / market close)
// In alpha, nothing reaches the user before SENT, and SENT requires explicit
// provider approval (autoSendEnabled defaults false).
export const OFFER_TRANSITIONS: TransitionMap<OfferStatus> = {
  [OfferStatus.SUGGESTED]: [
    OfferStatus.APPROVED,
    OfferStatus.EDITED,
    OfferStatus.DECLINED,
    OfferStatus.EXPIRED,
  ],
  [OfferStatus.APPROVED]: [
    OfferStatus.SENT,
    OfferStatus.DECLINED,
    OfferStatus.EXPIRED,
  ],
  [OfferStatus.EDITED]: [
    OfferStatus.SENT,
    OfferStatus.APPROVED,
    OfferStatus.DECLINED,
    OfferStatus.EXPIRED,
  ],
  [OfferStatus.SENT]: [
    OfferStatus.ACCEPTED,
    OfferStatus.REJECTED,
    OfferStatus.EXPIRED,
  ],
  [OfferStatus.DECLINED]: [],
  [OfferStatus.ACCEPTED]: [],
  [OfferStatus.REJECTED]: [],
  [OfferStatus.EXPIRED]: [],
};

export function assertOfferTransition(
  from: OfferStatus,
  to: OfferStatus,
): void {
  assertTransition("OfferObject", OFFER_TRANSITIONS, from, to);
}

export function canOfferTransition(
  from: OfferStatus,
  to: OfferStatus,
): boolean {
  return canTransition(OFFER_TRANSITIONS, from, to);
}
