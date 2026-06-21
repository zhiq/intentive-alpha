import {
  BookingStatus,
  IntentStatus,
  LiveIntentStatus,
  OfferStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertOfferTransition } from "@/domain/state/offer";
import { assertIntentTransition } from "@/domain/state/intent";
import { assertLiveIntentTransition } from "@/domain/state/liveIntent";
import { assertBookingTransition } from "@/domain/state/booking";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from "@/domain/errors";
import { MarketTraceService } from "./MarketTraceService";
import { RelationshipService } from "./RelationshipService";
import { ReliabilityService } from "./ReliabilityService";
import { MarketEvent } from "@/observability/events";

// The money-critical path. Accepting an offer is a single transaction that:
//  1. atomically reserves the availability slot (race-safe via guarded update),
//  2. accepts the chosen offer and rejects the rest,
//  3. creates the Booking,
//  4. advances the Intent and LiveIntent state machines,
//  5. writes audit traces.
// If the slot was taken between offer send and accept, the whole thing rolls
// back with a ConflictError — no double-booking, no partial writes.
export const BookingService = {
  async acceptOffer(offerId: string, userId: string) {
    const offer = await prisma.offerObject.findUnique({
      where: { id: offerId },
      include: {
        provider: true,
        liveIntent: { include: { intentObject: true } },
      },
    });
    if (!offer) throw new NotFoundError("OfferObject", offerId);
    const intent = offer.liveIntent.intentObject;
    if (intent.userId !== userId) throw new ForbiddenError();
    if (offer.status !== OfferStatus.SENT) {
      throw new ValidationError(
        `Offer is not acceptable in status ${offer.status}`,
      );
    }
    // Validate transitions up front (fail fast before opening the transaction).
    assertOfferTransition(offer.status, OfferStatus.ACCEPTED);
    assertIntentTransition(intent.status, IntentStatus.ACCEPTED);
    assertLiveIntentTransition(
      offer.liveIntent.status,
      LiveIntentStatus.FULFILLED,
    );

    const booking = await prisma.$transaction(async (tx) => {
      // 1. Reserve the slot atomically. The WHERE guard makes this safe under
      //    concurrent accepts: only one transaction can flip isBooked.
      if (offer.availabilityId) {
        const reserved = await tx.providerAvailability.updateMany({
          where: { id: offer.availabilityId, isBooked: false },
          data: { isBooked: true },
        });
        if (reserved.count === 0) {
          throw new ConflictError(
            "That time slot was just taken. Please choose another offer.",
            { offerId },
          );
        }
      }

      // 2. Accept this offer.
      await tx.offerObject.update({
        where: { id: offer.id },
        data: { status: OfferStatus.ACCEPTED },
      });

      // 3. Reject sibling SENT offers in the same Live Intent.
      await tx.offerObject.updateMany({
        where: {
          liveIntentId: offer.liveIntentId,
          id: { not: offer.id },
          status: OfferStatus.SENT,
        },
        data: { status: OfferStatus.REJECTED },
      });

      // 4. Create the booking.
      const created = await tx.booking.create({
        data: {
          offerObjectId: offer.id,
          userId,
          providerId: offer.providerId,
          status: BookingStatus.CONFIRMED,
          startTime: offer.startTime,
          endTime: offer.endTime,
          finalPrice: offer.price,
          depositAmount: offer.depositAmount,
        },
      });

      // 5. Advance intent + live intent.
      await tx.intentObject.update({
        where: { id: intent.id },
        data: { status: IntentStatus.ACCEPTED },
      });
      await tx.liveIntent.update({
        where: { id: offer.liveIntentId },
        data: { status: LiveIntentStatus.FULFILLED },
      });

      return created;
    });

    await MarketTraceService.record(
      MarketEvent.OFFER_ACCEPTED,
      { offerId: offer.id, bookingId: booking.id, price: offer.price },
      { intentObjectId: intent.id },
    );
    await MarketTraceService.record(
      MarketEvent.BOOKING_CREATED,
      { bookingId: booking.id, providerId: offer.providerId },
      { intentObjectId: intent.id },
    );

    return booking;
  },

  async listForUser(userId: string) {
    return prisma.booking.findMany({
      where: { userId },
      include: { provider: true, offer: true },
      orderBy: { startTime: "desc" },
    });
  },

  async listForProviderOwner(ownerUserId: string) {
    return prisma.booking.findMany({
      where: { provider: { ownerUserId } },
      include: { provider: true, offer: true, user: true },
      orderBy: { startTime: "desc" },
    });
  },

  /**
   * Mark a booking completed (provider/admin). Completion is where trust
   * compounds: it writes/updates the Relationship Asset and reliability signals.
   */
  async markCompleted(
    bookingId: string,
    actor: { userId: string; isAdmin: boolean },
  ) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { provider: true, offer: true },
    });
    if (!booking) throw new NotFoundError("Booking", bookingId);
    if (!actor.isAdmin && booking.provider.ownerUserId !== actor.userId) {
      throw new ForbiddenError();
    }
    assertBookingTransition(booking.status, BookingStatus.COMPLETED);

    const completed = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.COMPLETED },
    });

    await RelationshipService.recordCompletion(completed);
    await ReliabilityService.recordCompletion(completed);

    const intentId = await resolveIntentId(booking.offerObjectId);
    await MarketTraceService.record(
      MarketEvent.BOOKING_COMPLETED,
      { bookingId, providerId: booking.providerId },
      { intentObjectId: intentId },
    );

    return completed;
  },
};

async function resolveIntentId(offerObjectId: string): Promise<string | null> {
  const offer = await prisma.offerObject.findUnique({
    where: { id: offerObjectId },
    include: { liveIntent: true },
  });
  return offer?.liveIntent.intentObjectId ?? null;
}
