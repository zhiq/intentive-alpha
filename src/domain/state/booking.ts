import { BookingStatus } from "@prisma/client";
import { assertTransition, canTransition, type TransitionMap } from "./machine";

// Booking lifecycle:
//   CONFIRMED -> COMPLETED / CANCELLED / NO_SHOW / DISPUTED
//   COMPLETED -> DISPUTED
export const BOOKING_TRANSITIONS: TransitionMap<BookingStatus> = {
  [BookingStatus.CONFIRMED]: [
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
    BookingStatus.DISPUTED,
  ],
  [BookingStatus.COMPLETED]: [BookingStatus.DISPUTED],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.NO_SHOW]: [BookingStatus.DISPUTED],
  [BookingStatus.DISPUTED]: [],
};

export function assertBookingTransition(
  from: BookingStatus,
  to: BookingStatus,
): void {
  assertTransition("Booking", BOOKING_TRANSITIONS, from, to);
}

export function canBookingTransition(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return canTransition(BOOKING_TRANSITIONS, from, to);
}
