import { describe, it, expect } from "vitest";
import { MockAiProvider } from "@/ai/mock";
import { FulfillmentMode } from "@prisma/client";
import type {
  IntentProjection,
  PolicyProjection,
  ProviderProjection,
  OfferProjection,
} from "@/ai/types";

const ai = new MockAiProvider();

const intent: IntentProjection = {
  rawInput: "thai massage 2pm today 120 mins KLCC",
  category: "massage_wellness",
  serviceType: "Thai massage",
  requestedStartTime: new Date().toISOString(),
  requestedEndTime: null,
  durationMinutes: 120,
  locationText: "KLCC",
  fulfillmentMode: FulfillmentMode.VISIT_PROVIDER,
  budgetMin: null,
  budgetMax: 20000,
  preferences: {},
};

const provider: ProviderProjection = {
  id: "p1",
  businessName: "Serene Thai",
  baseLocation: "KLCC",
  rating: 4.7,
  responseTimeMinutes: 20,
  offersHomeService: true,
  offersInStoreService: true,
};

describe("MockAiProvider.generateProviderOffer", () => {
  it("never prices below the policy floor", async () => {
    const policy: PolicyProjection = {
      serviceType: "Thai massage",
      minPrice: 15000,
      standardPrice: 18000,
      maxDiscountPercent: 50,
      allowAddOns: false,
      allowedAddOns: [],
      requireDeposit: false,
      depositPercent: 0,
      cancellationPolicy: "Free up to 2h.",
    };
    const offer = await ai.generateProviderOffer({
      intent: { ...intent, budgetMax: 1000 }, // absurdly low budget
      provider,
      policy,
      slot: {
        id: "s1",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 7200_000).toISOString(),
      },
    });
    expect(offer.price).toBeGreaterThanOrEqual(policy.minPrice);
  });

  it("prefers a value add-on over discount on same-day idle slots", async () => {
    const policy: PolicyProjection = {
      serviceType: "Thai massage",
      minPrice: 15000,
      standardPrice: 18000,
      maxDiscountPercent: 20,
      allowAddOns: true,
      allowedAddOns: [
        { name: "Hot stone", price: 3000, durationMinutes: 15 },
      ],
      requireDeposit: false,
      depositPercent: 0,
      cancellationPolicy: "Free up to 2h.",
    };
    const offer = await ai.generateProviderOffer({
      intent,
      provider,
      policy,
      slot: {
        id: "s1",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 7200_000).toISOString(),
      },
    });
    expect(offer.addOns.length).toBe(1);
    expect(offer.price).toBe(policy.standardPrice); // not discounted
  });

  it("applies deposit when policy requires it", async () => {
    const policy: PolicyProjection = {
      serviceType: "Thai massage",
      minPrice: 15000,
      standardPrice: 18000,
      maxDiscountPercent: 0,
      allowAddOns: false,
      allowedAddOns: [],
      requireDeposit: true,
      depositPercent: 20,
      cancellationPolicy: "Free up to 2h.",
    };
    const offer = await ai.generateProviderOffer({
      intent,
      provider,
      policy,
      slot: {
        id: "s1",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 7200_000).toISOString(),
      },
    });
    expect(offer.depositRequired).toBe(true);
    expect(offer.depositAmount).toBe(Math.round((offer.price * 20) / 100));
  });
});

describe("MockAiProvider.rankOffers", () => {
  it("scores cheaper, closer, higher-rated offers more favorably", async () => {
    const offers: OfferProjection[] = [
      {
        id: "cheap-near",
        providerName: "A",
        serviceType: "Thai massage",
        startTime: new Date().toISOString(),
        durationMinutes: 120,
        price: 15000,
        distanceKm: 1,
        rating: 4.8,
        responseTimeMinutes: 15,
      },
      {
        id: "pricey-far",
        providerName: "B",
        serviceType: "Thai massage",
        startTime: new Date().toISOString(),
        durationMinutes: 120,
        price: 24000,
        distanceKm: 9,
        rating: 4.0,
        responseTimeMinutes: 90,
      },
    ];
    const { scores } = await ai.rankOffers({ intent, offers });
    const cheap = scores.find((s) => s.offerId === "cheap-near")!;
    const pricey = scores.find((s) => s.offerId === "pricey-far")!;
    expect(cheap.valueScore).toBeGreaterThan(pricey.valueScore);
    expect(cheap.convenienceScore).toBeGreaterThan(pricey.convenienceScore);
    expect(cheap.riskScore).toBeLessThan(pricey.riskScore);
  });
});
