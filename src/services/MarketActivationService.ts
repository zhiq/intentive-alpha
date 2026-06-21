import {
  IntentStatus,
  LiveIntentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertIntentTransition } from "@/domain/state/intent";
import { ValidationError, NotFoundError, ForbiddenError } from "@/domain/errors";
import {
  DEFAULT_INTENT_TTL_MINUTES,
  LOW_LIQUIDITY_THRESHOLD,
} from "@/domain/enums";
import { ProviderMatchingService } from "./ProviderMatchingService";
import { OfferAutopilotService } from "./OfferAutopilotService";
import { MissingFieldService } from "./MissingFieldService";
import { MarketTraceService } from "./MarketTraceService";
import { MarketEvent } from "@/observability/events";

export interface ActivationResult {
  liveIntentId: string;
  providersInvited: number;
  offersGenerated: number;
  lowLiquidity: boolean;
}

// Turns a MARKET_ACTIONABLE intent into a LIVE market: creates the LiveIntent,
// matches+invites the top providers, and kicks the autopilot to draft offers.
// Provider attention is protected (top N only) and low-liquidity is surfaced.
export const MarketActivationService = {
  /** Preview eligibility/liquidity WITHOUT activating (for pre-activation warning). */
  async previewLiquidity(intentId: string, userId: string) {
    const intent = await loadOwned(intentId, userId);
    const eligible = await ProviderMatchingService.findEligible(intent);
    return {
      eligibleCount: eligible.length,
      lowLiquidity: eligible.length < LOW_LIQUIDITY_THRESHOLD,
    };
  },

  async activate(intentId: string, userId: string): Promise<ActivationResult> {
    const intent = await loadOwned(intentId, userId);

    if (!MissingFieldService.isMarketActionable(intent)) {
      throw new ValidationError(
        "Intent still has missing mandatory details and cannot go live",
        { missing: MissingFieldService.detect(intent).missing },
      );
    }
    // Enforce the state machine: only MARKET_ACTIONABLE -> LIVE.
    assertIntentTransition(intent.status, IntentStatus.LIVE);

    const eligible = await ProviderMatchingService.findEligible(intent);
    const lowLiquidity = eligible.length < LOW_LIQUIDITY_THRESHOLD;

    const expiresAt =
      intent.expiresAt ??
      new Date(Date.now() + DEFAULT_INTENT_TTL_MINUTES * 60_000);

    // Create the LIVE intent + LiveIntent atomically.
    const liveIntent = await prisma.$transaction(async (tx) => {
      await tx.intentObject.update({
        where: { id: intent.id },
        data: { status: IntentStatus.LIVE },
      });
      return tx.liveIntent.create({
        data: {
          intentObjectId: intent.id,
          status: LiveIntentStatus.ACTIVE,
          providersInvitedCount: eligible.length,
          expiresAt,
        },
      });
    });

    await MarketTraceService.record(
      MarketEvent.INTENT_ACTIVATED,
      { liveIntentId: liveIntent.id },
      { intentObjectId: intent.id },
    );
    await MarketTraceService.record(
      MarketEvent.PROVIDERS_MATCHED,
      {
        eligibleCount: eligible.length,
        providerIds: eligible.map((e) => e.provider.id),
        scores: eligible.map((e) => e.candidate.matchScore),
      },
      { intentObjectId: intent.id },
    );
    for (const e of eligible) {
      await MarketTraceService.record(
        MarketEvent.PROVIDER_INVITED,
        { providerId: e.provider.id, matchScore: e.candidate.matchScore },
        { intentObjectId: intent.id },
      );
    }
    if (lowLiquidity) {
      await MarketTraceService.record(
        MarketEvent.LOW_LIQUIDITY_WARNING,
        { eligibleCount: eligible.length },
        { intentObjectId: intent.id },
      );
    }

    // Draft suggested offers (provider still must approve unless autoSend).
    const offersGenerated = await OfferAutopilotService.generateForLiveIntent(
      liveIntent.id,
      intent,
      eligible,
    );

    // Reflect any auto-sent offers in counts + OFFER_READY.
    await this.syncLiveIntentCounters(liveIntent.id);

    return {
      liveIntentId: liveIntent.id,
      providersInvited: eligible.length,
      offersGenerated,
      lowLiquidity,
    };
  },

  /**
   * Recompute LiveIntent counters from its offers, and move the parent intent to
   * OFFER_READY once at least one offer has been SENT. Idempotent.
   */
  async syncLiveIntentCounters(liveIntentId: string) {
    const live = await prisma.liveIntent.findUnique({
      where: { id: liveIntentId },
      include: { offers: true, intentObject: true },
    });
    if (!live) return;

    const sentOffers = live.offers.filter((o) =>
      ["SENT", "ACCEPTED", "REJECTED"].includes(o.status),
    );
    const firstSent = sentOffers
      .map((o) => o.updatedAt)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    await prisma.liveIntent.update({
      where: { id: liveIntentId },
      data: {
        offersReceivedCount: sentOffers.length,
        firstOfferAt: live.firstOfferAt ?? firstSent ?? null,
      },
    });

    if (
      sentOffers.length > 0 &&
      live.intentObject.status === IntentStatus.LIVE
    ) {
      assertIntentTransition(IntentStatus.LIVE, IntentStatus.OFFER_READY);
      await prisma.intentObject.update({
        where: { id: live.intentObjectId },
        data: { status: IntentStatus.OFFER_READY },
      });
      await MarketTraceService.record(
        MarketEvent.OFFER_SENT,
        { liveIntentId, offersReady: sentOffers.length },
        { intentObjectId: live.intentObjectId },
      );
    }
  },
};

async function loadOwned(intentId: string, userId: string) {
  const intent = await prisma.intentObject.findUnique({
    where: { id: intentId },
  });
  if (!intent) throw new NotFoundError("IntentObject", intentId);
  if (intent.userId !== userId) throw new ForbiddenError();
  return intent;
}
