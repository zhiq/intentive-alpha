import {
  OfferStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertOfferTransition } from "@/domain/state/offer";
import { offerEditSchema } from "@/domain/schema/offer";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  PolicyViolationError,
} from "@/domain/errors";
import { MarketTraceService } from "./MarketTraceService";
import { MarketActivationService } from "./MarketActivationService";
import { MarketEvent } from "@/observability/events";

// Provider-side offer triage. Every action checks that the acting provider owns
// the offer (server-side authz) and goes through the offer state machine. Price
// edits are bounded by the provider's own policy floor.
export const OfferService = {
  async getForProvider(offerId: string, providerOwnerUserId: string) {
    const offer = await prisma.offerObject.findUnique({
      where: { id: offerId },
      include: { provider: true, liveIntent: { include: { intentObject: true } } },
    });
    if (!offer) throw new NotFoundError("OfferObject", offerId);
    if (offer.provider.ownerUserId !== providerOwnerUserId) {
      throw new ForbiddenError();
    }
    return offer;
  },

  async approveAndSend(offerId: string, providerOwnerUserId: string) {
    const offer = await this.getForProvider(offerId, providerOwnerUserId);
    assertOfferTransition(offer.status, OfferStatus.APPROVED);
    assertOfferTransition(OfferStatus.APPROVED, OfferStatus.SENT);

    const updated = await prisma.offerObject.update({
      where: { id: offerId },
      data: { status: OfferStatus.SENT },
    });
    await MarketTraceService.record(
      MarketEvent.OFFER_APPROVED,
      { offerId },
      { intentObjectId: offer.liveIntent.intentObjectId },
    );
    await MarketTraceService.record(
      MarketEvent.OFFER_SENT,
      { offerId },
      { intentObjectId: offer.liveIntent.intentObjectId },
    );
    await MarketActivationService.syncLiveIntentCounters(offer.liveIntentId);
    return updated;
  },

  async editAndSend(
    offerId: string,
    providerOwnerUserId: string,
    input: unknown,
    send = true,
  ) {
    const parsed = offerEditSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Invalid offer edit", {
        issues: parsed.error.issues,
      });
    }
    const offer = await this.getForProvider(offerId, providerOwnerUserId);
    const edit = parsed.data;

    // Provider may edit above policy, but never below their own minimum floor.
    if (edit.price !== undefined) {
      const policy = await prisma.providerOfferPolicy.findUnique({
        where: {
          providerId_serviceType: {
            providerId: offer.providerId,
            serviceType: offer.serviceType,
          },
        },
      });
      const floor = policy?.minPrice ?? 0;
      if (edit.price < floor) {
        throw new PolicyViolationError(
          "Edited price is below your minimum price floor",
          { floor, price: edit.price },
        );
      }
    }

    const data: Prisma.OfferObjectUpdateInput = {
      status: OfferStatus.EDITED,
      title: edit.title ?? undefined,
      startTime: edit.startTime ? new Date(edit.startTime) : undefined,
      endTime: edit.endTime ? new Date(edit.endTime) : undefined,
      durationMinutes: edit.durationMinutes ?? undefined,
      price: edit.price ?? undefined,
      addOnsJson: edit.addOns
        ? (edit.addOns as unknown as Prisma.InputJsonValue)
        : undefined,
      depositRequired: edit.depositRequired ?? undefined,
      depositAmount: edit.depositAmount ?? undefined,
      cancellationPolicy: edit.cancellationPolicy ?? undefined,
      reasonedBrief: edit.reasonedBrief ?? undefined,
      providerEditNotes: edit.providerEditNotes ?? undefined,
    };

    assertOfferTransition(offer.status, OfferStatus.EDITED);
    let updated = await prisma.offerObject.update({
      where: { id: offerId },
      data,
    });
    await MarketTraceService.record(
      MarketEvent.OFFER_EDITED,
      { offerId },
      { intentObjectId: offer.liveIntent.intentObjectId },
    );

    if (send) {
      assertOfferTransition(OfferStatus.EDITED, OfferStatus.SENT);
      updated = await prisma.offerObject.update({
        where: { id: offerId },
        data: { status: OfferStatus.SENT },
      });
      await MarketTraceService.record(
        MarketEvent.OFFER_SENT,
        { offerId },
        { intentObjectId: offer.liveIntent.intentObjectId },
      );
      await MarketActivationService.syncLiveIntentCounters(offer.liveIntentId);
    }
    return updated;
  },

  async decline(offerId: string, providerOwnerUserId: string) {
    const offer = await this.getForProvider(offerId, providerOwnerUserId);
    assertOfferTransition(offer.status, OfferStatus.DECLINED);
    const updated = await prisma.offerObject.update({
      where: { id: offerId },
      data: { status: OfferStatus.DECLINED },
    });
    await MarketTraceService.record(
      MarketEvent.OFFER_DECLINED,
      { offerId },
      { intentObjectId: offer.liveIntent.intentObjectId },
    );
    return updated;
  },

  /** Offers awaiting this provider-owner's approval across their providers. */
  async listAwaitingApproval(providerOwnerUserId: string) {
    return prisma.offerObject.findMany({
      where: {
        status: { in: [OfferStatus.SUGGESTED, OfferStatus.EDITED, OfferStatus.APPROVED] },
        provider: { ownerUserId: providerOwnerUserId },
      },
      include: {
        provider: true,
        liveIntent: { include: { intentObject: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
