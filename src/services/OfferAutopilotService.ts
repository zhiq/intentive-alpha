import {
  OfferStatus,
  type Prisma,
  type IntentObject,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAiFallback } from "@/ai";
import { suggestedOfferSchema } from "@/domain/schema/offer";
import { AiOutputError } from "@/domain/errors";
import { clamp } from "@/lib/utils";
import { toIntentProjection } from "./projections";
import { MarketTraceService } from "./MarketTraceService";
import { MarketEvent } from "@/observability/events";
import type { EligibleProvider } from "./ProviderMatchingService";
import type { SuggestedOfferDTO } from "@/domain/schema/offer";
import type {
  AvailabilitySlot,
  PolicyProjection,
  ProviderProjection,
} from "@/ai/types";

// Generates a Suggested Offer per eligible provider. The AI drafts; this service
// is the authority that CLAMPS every draft to provider policy before persisting.
// Even a misbehaving model can never produce an out-of-policy offer.
export const OfferAutopilotService = {
  async generateForLiveIntent(
    liveIntentId: string,
    intent: IntentObject,
    eligible: EligibleProvider[],
  ): Promise<number> {
    let created = 0;
    for (const e of eligible) {
      // Respect provider auto-suggest toggle.
      if (e.policy && !e.policy.autoSuggestEnabled) continue;
      const offer = await this.generateOne(liveIntentId, intent, e);
      if (offer) created++;
    }
    return created;
  },

  async generateOne(
    liveIntentId: string,
    intent: IntentObject,
    e: EligibleProvider,
  ) {
    const policyProjection: PolicyProjection = e.policy
      ? {
          serviceType: e.policy.serviceType,
          minPrice: e.policy.minPrice,
          standardPrice: e.policy.standardPrice,
          maxDiscountPercent: e.policy.maxDiscountPercent,
          allowAddOns: e.policy.allowAddOns,
          allowedAddOns: parseAddOns(e.policy.allowedAddOns),
          requireDeposit: e.policy.requireDeposit,
          depositPercent: e.policy.depositPercent,
          cancellationPolicy: e.policy.cancellationPolicy,
        }
      : defaultPolicy(e);

    const providerProjection: ProviderProjection = {
      id: e.provider.id,
      businessName: e.provider.businessName,
      baseLocation: e.provider.baseLocation,
      rating: e.provider.rating,
      responseTimeMinutes: e.provider.responseTimeMinutes,
      offersHomeService: e.provider.offersHomeService,
      offersInStoreService: e.provider.offersInStoreService,
    };

    const slot: AvailabilitySlot = {
      id: e.slot.id,
      startTime: e.slot.startTime.toISOString(),
      endTime: e.slot.endTime.toISOString(),
    };

    let draft: SuggestedOfferDTO;
    try {
      draft = await withAiFallback("generateProviderOffer", (p) =>
        p.generateProviderOffer({
          intent: toIntentProjection(intent),
          provider: providerProjection,
          policy: policyProjection,
          slot,
        }),
      );
    } catch (err) {
      if (err instanceof AiOutputError) {
        await MarketTraceService.record(
          MarketEvent.VALIDATION_FAILURE,
          { op: "generateProviderOffer", providerId: e.provider.id },
          { intentObjectId: intent.id },
        );
        return null;
      }
      throw err;
    }

    // Validate then CLAMP to policy. This is the guardrail.
    const validated = suggestedOfferSchema.parse(draft);
    const clamped = clampToPolicy(validated, policyProjection);

    const offer = await prisma.offerObject.create({
      data: {
        liveIntentId,
        providerId: e.provider.id,
        status: OfferStatus.SUGGESTED,
        title: clamped.title,
        serviceType: clamped.serviceType,
        startTime: new Date(clamped.startTime),
        endTime: new Date(clamped.endTime),
        durationMinutes: clamped.durationMinutes,
        price: clamped.price,
        currency: clamped.currency,
        addOnsJson: clamped.addOns as unknown as Prisma.InputJsonValue,
        depositRequired: clamped.depositRequired,
        depositAmount: clamped.depositAmount,
        cancellationPolicy: clamped.cancellationPolicy,
        reasonedBrief: clamped.reasonedBrief,
        availabilityId: e.slot.id,
      },
    });

    await MarketTraceService.record(
      MarketEvent.OFFER_SUGGESTED,
      { offerId: offer.id, providerId: e.provider.id, price: clamped.price },
      { intentObjectId: intent.id },
    );

    // Auto-send only if the provider explicitly enabled it (default false).
    if (e.policy?.autoSendEnabled) {
      const sent = await prisma.offerObject.update({
        where: { id: offer.id },
        data: { status: OfferStatus.SENT },
      });
      await MarketTraceService.record(
        MarketEvent.OFFER_SENT,
        { offerId: offer.id, auto: true },
        { intentObjectId: intent.id },
      );
      return sent;
    }

    return offer;
  },
};

/** Enforce policy invariants the AI must never violate. */
function clampToPolicy(
  offer: SuggestedOfferDTO,
  policy: PolicyProjection,
): SuggestedOfferDTO {
  const price = clamp(offer.price, policy.minPrice, policy.standardPrice);

  const addOns = policy.allowAddOns ? offer.addOns.slice(0, 5) : [];

  let depositRequired = offer.depositRequired;
  let depositAmount = offer.depositAmount;
  if (policy.requireDeposit) {
    depositRequired = true;
    depositAmount = Math.round((price * policy.depositPercent) / 100);
  } else {
    depositRequired = false;
    depositAmount = 0;
  }

  return {
    ...offer,
    price,
    addOns,
    depositRequired,
    depositAmount,
    cancellationPolicy: policy.cancellationPolicy || offer.cancellationPolicy,
  };
}

function parseAddOns(
  json: Prisma.JsonValue,
): { name: string; price: number; durationMinutes: number }[] {
  if (!Array.isArray(json)) return [];
  const out: { name: string; price: number; durationMinutes: number }[] = [];
  for (const item of json) {
    if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof (item as Record<string, unknown>).name === "string"
    ) {
      const o = item as Record<string, unknown>;
      out.push({
        name: o.name as string,
        price: typeof o.price === "number" ? o.price : 0,
        durationMinutes:
          typeof o.durationMinutes === "number" ? o.durationMinutes : 0,
      });
    }
  }
  return out;
}

function defaultPolicy(e: EligibleProvider): PolicyProjection {
  return {
    serviceType: e.service.serviceType,
    minPrice: e.service.minPrice,
    standardPrice: e.service.basePrice,
    maxDiscountPercent: 0,
    allowAddOns: false,
    allowedAddOns: [],
    requireDeposit: false,
    depositPercent: 0,
    cancellationPolicy: "Free cancellation up to 2 hours before.",
  };
}
