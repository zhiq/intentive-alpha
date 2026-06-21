import { describe, it, expect } from "vitest";
import {
  IntentStatus,
  OfferStatus,
  BookingStatus,
  LiveIntentStatus,
} from "@prisma/client";
import {
  assertIntentTransition,
  canIntentTransition,
} from "@/domain/state/intent";
import { assertOfferTransition } from "@/domain/state/offer";
import { assertBookingTransition } from "@/domain/state/booking";
import { assertLiveIntentTransition } from "@/domain/state/liveIntent";
import { InvalidTransitionError } from "@/domain/errors";

describe("intent state machine", () => {
  it("allows the canonical happy-path transitions", () => {
    expect(() =>
      assertIntentTransition(IntentStatus.DRAFT, IntentStatus.NEEDS_DETAILS),
    ).not.toThrow();
    expect(() =>
      assertIntentTransition(
        IntentStatus.NEEDS_DETAILS,
        IntentStatus.MARKET_ACTIONABLE,
      ),
    ).not.toThrow();
    expect(() =>
      assertIntentTransition(IntentStatus.MARKET_ACTIONABLE, IntentStatus.LIVE),
    ).not.toThrow();
    expect(() =>
      assertIntentTransition(IntentStatus.LIVE, IntentStatus.OFFER_READY),
    ).not.toThrow();
    expect(() =>
      assertIntentTransition(IntentStatus.OFFER_READY, IntentStatus.ACCEPTED),
    ).not.toThrow();
  });

  it("rejects illegal transitions with a typed error", () => {
    expect(() =>
      assertIntentTransition(IntentStatus.DRAFT, IntentStatus.LIVE),
    ).toThrow(InvalidTransitionError);
    expect(() =>
      assertIntentTransition(IntentStatus.ACCEPTED, IntentStatus.LIVE),
    ).toThrow(InvalidTransitionError);
  });

  it("treats same-state as a no-op (idempotent)", () => {
    expect(canIntentTransition(IntentStatus.LIVE, IntentStatus.LIVE)).toBe(true);
  });
});

describe("offer state machine", () => {
  it("permits SUGGESTED → APPROVED → SENT → ACCEPTED", () => {
    expect(() =>
      assertOfferTransition(OfferStatus.SUGGESTED, OfferStatus.APPROVED),
    ).not.toThrow();
    expect(() =>
      assertOfferTransition(OfferStatus.APPROVED, OfferStatus.SENT),
    ).not.toThrow();
    expect(() =>
      assertOfferTransition(OfferStatus.SENT, OfferStatus.ACCEPTED),
    ).not.toThrow();
  });

  it("forbids sending a suggested offer without approval", () => {
    expect(() =>
      assertOfferTransition(OfferStatus.SUGGESTED, OfferStatus.SENT),
    ).toThrow(InvalidTransitionError);
  });
});

describe("booking + live intent state machines", () => {
  it("allows CONFIRMED → COMPLETED", () => {
    expect(() =>
      assertBookingTransition(BookingStatus.CONFIRMED, BookingStatus.COMPLETED),
    ).not.toThrow();
  });
  it("forbids COMPLETED → CONFIRMED", () => {
    expect(() =>
      assertBookingTransition(BookingStatus.COMPLETED, BookingStatus.CONFIRMED),
    ).toThrow(InvalidTransitionError);
  });
  it("allows ACTIVE → FULFILLED for live intent", () => {
    expect(() =>
      assertLiveIntentTransition(
        LiveIntentStatus.ACTIVE,
        LiveIntentStatus.FULFILLED,
      ),
    ).not.toThrow();
  });
});
