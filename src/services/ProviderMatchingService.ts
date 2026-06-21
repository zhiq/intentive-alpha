import {
  FulfillmentMode,
  type IntentObject,
  type Provider,
  type ProviderAvailability,
  type ProviderService,
  type ProviderOfferPolicy,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { distanceKm, clamp } from "@/lib/utils";
import { resolveIntentPoint } from "@/lib/geo";
import {
  MAX_PROVIDERS_INVITED,
  MIN_PROVIDER_RELIABILITY,
} from "@/domain/enums";
import type { MatchCandidate } from "@/domain/types";

export interface EligibleProvider {
  provider: Provider;
  service: ProviderService;
  policy: ProviderOfferPolicy | null;
  slot: ProviderAvailability;
  candidate: MatchCandidate;
}

// Deterministic provider matching. Filters to genuinely eligible supply, scores
// each on a transparent breakdown, then returns only the top N (attention
// protection). No AI here — eligibility and ranking of SUPPLY are business
// rules, not language tasks.
export const ProviderMatchingService = {
  async findEligible(
    intent: IntentObject,
    limit = MAX_PROVIDERS_INVITED,
  ): Promise<EligibleProvider[]> {
    if (!intent.serviceType || !intent.requestedStartTime || !intent.durationMinutes) {
      return [];
    }
    const duration = intent.durationMinutes;
    const start = intent.requestedStartTime;
    const flexMs = (intent.flexibilityTimeMinutes ?? 0) * 60_000;
    const windowStart = new Date(start.getTime() - flexMs);
    const windowEnd = new Date(
      start.getTime() + duration * 60_000 + flexMs,
    );

    const { point: intentPoint } = resolveIntentPoint(intent);
    const travelRadius = intent.travelRadiusKm ?? null;

    // Pull active providers offering this service type with a compatible
    // fulfillment mode and an open, overlapping slot.
    const providers = await prisma.provider.findMany({
      where: {
        isActive: true,
        reliabilityScore: { gte: MIN_PROVIDER_RELIABILITY },
        services: {
          some: { serviceType: intent.serviceType, isActive: true },
        },
        availability: {
          some: {
            isBooked: false,
            startTime: { lte: windowStart },
            endTime: { gte: windowEnd },
          },
        },
      },
      include: {
        services: { where: { serviceType: intent.serviceType, isActive: true } },
        offerPolicies: { where: { serviceType: intent.serviceType } },
        availability: {
          where: {
            isBooked: false,
            startTime: { lte: windowStart },
            endTime: { gte: windowEnd },
          },
          orderBy: { startTime: "asc" },
        },
      },
    });

    const eligible: EligibleProvider[] = [];

    for (const provider of providers) {
      const service = provider.services[0];
      const slot = provider.availability[0];
      if (!service || !slot) continue;

      // Fulfillment compatibility.
      if (!fulfillmentCompatible(intent.fulfillmentMode, provider)) continue;

      // Distance / serviceability.
      const dist = distanceKm(
        { latitude: intentPoint.lat, longitude: intentPoint.lng },
        { latitude: provider.latitude, longitude: provider.longitude },
      );
      const maxReach = Math.min(
        provider.serviceRadiusKm,
        travelRadius ?? Number.POSITIVE_INFINITY,
      );
      // For home service the provider must travel to the user; for visit, the
      // user travels — either way we use the same straight-line gate in alpha.
      if (dist > maxReach) continue;

      // Price-fit feasibility if a budget exists.
      const policy = provider.offerPolicies[0] ?? null;
      const floor = policy?.minPrice ?? service.minPrice;
      if (intent.budgetMax !== null) {
        const flexPct = intent.flexibilityBudgetPercent ?? 0;
        const budgetCeil = Math.round(intent.budgetMax * (1 + flexPct / 100));
        if (floor > budgetCeil) continue; // cannot meet budget even at floor
      }

      const candidate = scoreCandidate({
        intent,
        provider,
        service,
        policy,
        slot,
        dist,
      });
      eligible.push({ provider, service, policy, slot, candidate });
    }

    eligible.sort((a, b) => b.candidate.matchScore - a.candidate.matchScore);
    return eligible.slice(0, limit);
  },
};

function fulfillmentCompatible(
  mode: FulfillmentMode,
  provider: Provider,
): boolean {
  switch (mode) {
    case FulfillmentMode.HOME_SERVICE:
      return provider.offersHomeService;
    case FulfillmentMode.VISIT_PROVIDER:
      return provider.offersInStoreService;
    case FulfillmentMode.EITHER:
    case FulfillmentMode.UNKNOWN:
      return provider.offersHomeService || provider.offersInStoreService;
  }
}

function scoreCandidate(args: {
  intent: IntentObject;
  provider: Provider;
  service: ProviderService;
  policy: ProviderOfferPolicy | null;
  slot: ProviderAvailability;
  dist: number;
}): MatchCandidate {
  const { intent, provider, service, policy, slot, dist } = args;

  const serviceMatch = service.serviceType === intent.serviceType ? 1 : 0.5;

  // Time match: how close the slot start is to the requested start.
  const reqStart = intent.requestedStartTime!.getTime();
  const slotStart = slot.startTime.getTime();
  const gapMin = Math.abs(slotStart - reqStart) / 60_000;
  const timeMatch = clamp(1 - gapMin / 240, 0, 1); // within 4h fully decays

  // Distance match relative to provider reach.
  const reach = provider.serviceRadiusKm || 10;
  const distanceMatch = clamp(1 - dist / reach, 0, 1);

  const ratingMatch = clamp(provider.rating / 5, 0, 1);
  const responseMatch = clamp(1 - provider.responseTimeMinutes / 120, 0, 1);

  // Price fit: standard price vs budget midpoint when available.
  const standard = policy?.standardPrice ?? service.basePrice;
  let priceFit = 0.7;
  if (intent.budgetMax !== null) {
    priceFit = standard <= intent.budgetMax ? 1 : 0.4;
  }

  // Preference fit: therapist gender etc. (alpha: neutral baseline).
  const preferenceFit = 0.7;

  const availabilityConfidence = slot.isBooked ? 0 : 1;

  const matchScore = clamp(
    serviceMatch * 0.25 +
      timeMatch * 0.2 +
      distanceMatch * 0.15 +
      ratingMatch * 0.15 +
      responseMatch * 0.05 +
      priceFit * 0.1 +
      preferenceFit * 0.05 +
      availabilityConfidence * 0.05,
    0,
    1,
  );

  return {
    providerId: provider.id,
    matchScore: Math.round(matchScore * 100) / 100,
    breakdown: {
      serviceMatch,
      timeMatch: Math.round(timeMatch * 100) / 100,
      distanceMatch: Math.round(distanceMatch * 100) / 100,
      ratingMatch: Math.round(ratingMatch * 100) / 100,
      responseMatch: Math.round(responseMatch * 100) / 100,
      priceFit,
      preferenceFit,
      availabilityConfidence,
    },
    matchedAvailabilityId: slot.id,
    distanceKm: Math.round(dist * 10) / 10,
  };
}
