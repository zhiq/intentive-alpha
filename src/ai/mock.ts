import { applyDiscountPercent, formatMoney } from "@/lib/money";
import type { ParsedIntentDTO } from "@/domain/schema/intent";
import type {
  SuggestedOfferDTO,
  OfferBriefDTO,
  OfferRankingDTO,
} from "@/domain/schema/offer";
import type { MissingFieldsResult } from "@/domain/types";
import { clamp } from "@/lib/utils";
import { parseIntentDeterministic } from "./parsing";
import { detectMissingFieldsRule } from "./missingFields";
import type {
  AiProvider,
  AvailabilitySlot,
  IntentProjection,
  OfferProjection,
  PolicyProjection,
  ProviderProjection,
  UserContext,
} from "./types";

// Deterministic mock AI provider. No network, no keys — same inputs always
// produce the same outputs, which makes the whole market testable. This is the
// default provider for local alpha development.
export class MockAiProvider implements AiProvider {
  readonly name = "mock" as const;

  async parseIntent(
    rawInput: string,
    context: UserContext,
  ): Promise<ParsedIntentDTO> {
    return parseIntentDeterministic(rawInput, context);
  }

  async detectMissingFields(
    intent: IntentProjection,
  ): Promise<MissingFieldsResult> {
    return detectMissingFieldsRule(intent);
  }

  async generateProviderOffer(input: {
    intent: IntentProjection;
    provider: ProviderProjection;
    policy: PolicyProjection;
    slot: AvailabilitySlot;
  }): Promise<SuggestedOfferDTO> {
    const { intent, provider, policy, slot } = input;
    const duration = intent.durationMinutes ?? 60;
    const start = new Date(slot.startTime);
    const end = new Date(start.getTime() + duration * 60_000);

    // Start from standard price. If this is a same-day idle slot and the policy
    // allows add-ons, prefer adding value over discounting (per offer rules).
    let price = policy.standardPrice;
    const addOns: SuggestedOfferDTO["addOns"] = [];
    const budgetMax = intent.budgetMax;

    const idleToday =
      start.toDateString() === new Date().toDateString() ? true : false;

    if (policy.allowAddOns && policy.allowedAddOns.length > 0 && idleToday) {
      const addOn = policy.allowedAddOns[0]!;
      addOns.push(addOn);
    } else if (
      budgetMax !== null &&
      price > budgetMax &&
      policy.maxDiscountPercent > 0
    ) {
      // Only discount to meet budget, never below the floor.
      const discounted = applyDiscountPercent(price, policy.maxDiscountPercent);
      price = Math.max(policy.minPrice, Math.max(discounted, budgetMax));
    }

    const depositRequired = policy.requireDeposit;
    const depositAmount = depositRequired
      ? Math.round((price * policy.depositPercent) / 100)
      : 0;

    const reasonedBrief = this.composeBrief({
      provider,
      serviceType: intent.serviceType ?? policy.serviceType,
      price,
      addOns,
      start,
      budgetMax,
    });

    return {
      title: `${intent.serviceType ?? policy.serviceType} with ${provider.businessName}`,
      serviceType: intent.serviceType ?? policy.serviceType,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes: duration,
      price,
      currency: "MYR",
      addOns,
      depositRequired,
      depositAmount,
      cancellationPolicy: policy.cancellationPolicy,
      reasonedBrief,
    };
  }

  async generateOfferBrief(input: {
    intent: IntentProjection;
    offer: SuggestedOfferDTO;
    provider: ProviderProjection;
  }): Promise<OfferBriefDTO> {
    const { intent, offer, provider } = input;
    return {
      reasonedBrief: this.composeBrief({
        provider,
        serviceType: offer.serviceType,
        price: offer.price,
        addOns: offer.addOns,
        start: new Date(offer.startTime),
        budgetMax: intent.budgetMax,
      }),
    };
  }

  async rankOffers(input: {
    intent: IntentProjection;
    offers: OfferProjection[];
  }): Promise<OfferRankingDTO> {
    const { intent, offers } = input;
    if (offers.length === 0) return { scores: [] };

    const prices = offers.map((o) => o.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const distances = offers.map((o) => o.distanceKm);
    const maxDist = Math.max(...distances, 1);

    const scores = offers.map((o) => {
      // Fit: service-type exact match + within requested window proximity.
      const serviceFit =
        intent.serviceType && o.serviceType === intent.serviceType ? 1 : 0.6;
      const fitScore = clamp(serviceFit * 0.7 + (o.rating / 5) * 0.3, 0, 1);

      // Value: cheaper is better, relative to the spread; budget-aware.
      const priceSpread = maxPrice - minPrice || 1;
      let valueScore = 1 - (o.price - minPrice) / priceSpread;
      if (intent.budgetMax !== null && o.price <= intent.budgetMax) {
        valueScore = clamp(valueScore + 0.1, 0, 1);
      }
      valueScore = clamp(valueScore, 0, 1);

      // Convenience: closer + faster responder.
      const distScore = 1 - o.distanceKm / maxDist;
      const respScore = clamp(1 - o.responseTimeMinutes / 120, 0, 1);
      const convenienceScore = clamp(distScore * 0.6 + respScore * 0.4, 0, 1);

      // Risk: lower rating / slower response => higher risk.
      const riskScore = clamp(
        0.6 * (1 - o.rating / 5) + 0.4 * (o.responseTimeMinutes / 120),
        0,
        1,
      );

      return {
        offerId: o.id,
        fitScore: round(fitScore),
        valueScore: round(valueScore),
        convenienceScore: round(convenienceScore),
        riskScore: round(riskScore),
      };
    });

    return { scores };
  }

  async generateUserFriendlyClarification(
    _intent: IntentProjection,
    missing: MissingFieldsResult,
  ): Promise<{ message: string }> {
    if (missing.missing.length === 0) {
      return {
        message: "Your request is ready to go live — no more details needed.",
      };
    }
    const labels: Record<string, string> = {
      serviceType: "which massage style",
      requestedStartTime: "what time you'd like to start",
      durationMinutes: "how long the session should be",
      location: "where you are (or allow current location)",
      fulfillmentMode: "whether you want a home visit or to go to the provider",
    };
    const parts = missing.missing.map((m) => labels[m] ?? m);
    const list =
      parts.length === 1
        ? parts[0]
        : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
    return {
      message: `Almost there — just tell us ${list} and we'll activate your request.`,
    };
  }

  private composeBrief(args: {
    provider: ProviderProjection;
    serviceType: string;
    price: number;
    addOns: { name: string; price: number; durationMinutes: number }[];
    start: Date;
    budgetMax: number | null;
  }): string {
    const { provider, serviceType, price, addOns, start, budgetMax } = args;
    const time = start.toLocaleString("en-MY", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const lines: string[] = [];
    lines.push(
      `${provider.businessName} can do your ${serviceType} at ${time}.`,
    );
    lines.push(
      `Rated ${provider.rating.toFixed(1)}/5 and typically responds in ~${provider.responseTimeMinutes} min.`,
    );
    if (addOns.length > 0) {
      lines.push(
        `Includes a complimentary-style add-on (${addOns[0]!.name}) instead of cutting the rate — more value for the same idle slot.`,
      );
    }
    if (budgetMax !== null) {
      lines.push(
        price <= budgetMax
          ? `At ${formatMoney(price)} this sits within your ${formatMoney(budgetMax)} budget.`
          : `At ${formatMoney(price)} this is slightly above your ${formatMoney(budgetMax)} budget — but reflects this provider's quality.`,
      );
    } else {
      lines.push(`Offered at ${formatMoney(price)}.`);
    }
    return lines.join(" ");
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
