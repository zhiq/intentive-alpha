import type { Booking } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MarketTraceService } from "./MarketTraceService";
import { MarketEvent } from "@/observability/events";

// Maintains the Relationship Asset between a user and a provider. On each
// completed booking we upsert the asset, bump rebooking count, and refresh the
// "usual" service/duration/budget that powers the "same as last time" flow.
export const RelationshipService = {
  async recordCompletion(booking: Booking) {
    const existing = await prisma.relationshipAsset.findUnique({
      where: {
        userId_providerId: {
          userId: booking.userId,
          providerId: booking.providerId,
        },
      },
    });

    const offer = await prisma.offerObject.findUnique({
      where: { id: booking.offerObjectId },
    });

    const asset = await prisma.relationshipAsset.upsert({
      where: {
        userId_providerId: {
          userId: booking.userId,
          providerId: booking.providerId,
        },
      },
      create: {
        userId: booking.userId,
        providerId: booking.providerId,
        lastBookingId: booking.id,
        usualServiceType: offer?.serviceType ?? null,
        usualDurationMinutes: offer?.durationMinutes ?? null,
        usualBudgetMin: booking.finalPrice,
        usualBudgetMax: booking.finalPrice,
        rebookingCount: 0,
        satisfactionScore: 0,
      },
      update: {
        lastBookingId: booking.id,
        usualServiceType: offer?.serviceType ?? existing?.usualServiceType,
        usualDurationMinutes:
          offer?.durationMinutes ?? existing?.usualDurationMinutes,
        rebookingCount: { increment: 1 },
      },
    });

    await MarketTraceService.record(MarketEvent.RELATIONSHIP_UPDATED, {
      userId: booking.userId,
      providerId: booking.providerId,
      rebookingCount: asset.rebookingCount,
    });

    return asset;
  },

  async findForUser(userId: string) {
    return prisma.relationshipAsset.findMany({
      where: { userId },
      include: { provider: true, lastBooking: true },
      orderBy: { updatedAt: "desc" },
    });
  },
};
