import { OfferStatus, type OfferObject, type Provider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAiFallback } from "@/ai";
import { distanceKm } from "@/lib/utils";
import { resolveIntentPoint } from "@/lib/geo";
import { toIntentProjection } from "./projections";
import type { OfferHighlight } from "@/domain/types";
import type { OfferProjection } from "@/ai/types";

export interface RankedOffer {
  offer: OfferObject & { provider: Provider };
  scores: {
    fitScore: number;
    valueScore: number;
    convenienceScore: number;
    riskScore: number;
  };
  highlights: OfferHighlight[];
  distanceKm: number;
}

// Ranks SENT offers for a Live Intent and assigns at most three highlights:
// Recommended, Best Value, Fastest/Most Convenient. Persists scores back onto
// the offers so the inbox renders consistently. Returns a small, curated set —
// never an overwhelming list.
export const OfferRankingService = {
  async rankForLiveIntent(liveIntentId: string): Promise<RankedOffer[]> {
    const live = await prisma.liveIntent.findUnique({
      where: { id: liveIntentId },
      include: {
        intentObject: true,
        offers: {
          where: { status: { in: [OfferStatus.SENT, OfferStatus.ACCEPTED] } },
          include: { provider: true },
        },
      },
    });
    if (!live || live.offers.length === 0) return [];

    const intent = live.intentObject;
    const { point } = resolveIntentPoint(intent);

    const projections: OfferProjection[] = live.offers.map((o) => ({
      id: o.id,
      providerName: o.provider.businessName,
      serviceType: o.serviceType,
      startTime: o.startTime.toISOString(),
      durationMinutes: o.durationMinutes,
      price: o.price,
      distanceKm: distanceKm(
        { latitude: point.lat, longitude: point.lng },
        { latitude: o.provider.latitude, longitude: o.provider.longitude },
      ),
      rating: o.provider.rating,
      responseTimeMinutes: o.provider.responseTimeMinutes,
    }));

    const { scores } = await withAiFallback("rankOffers", (p) =>
      p.rankOffers({ intent: toIntentProjection(intent), offers: projections }),
    );
    const scoreById = new Map(scores.map((s) => [s.offerId, s]));

    // Persist scores.
    await prisma.$transaction(
      live.offers.map((o) => {
        const s = scoreById.get(o.id);
        return prisma.offerObject.update({
          where: { id: o.id },
          data: {
            fitScore: s?.fitScore ?? 0,
            valueScore: s?.valueScore ?? 0,
            convenienceScore: s?.convenienceScore ?? 0,
            riskScore: s?.riskScore ?? 0,
          },
        });
      }),
    );

    const ranked: RankedOffer[] = live.offers.map((o) => {
      const s = scoreById.get(o.id);
      const proj = projections.find((p) => p.id === o.id)!;
      return {
        offer: o,
        scores: {
          fitScore: s?.fitScore ?? 0,
          valueScore: s?.valueScore ?? 0,
          convenienceScore: s?.convenienceScore ?? 0,
          riskScore: s?.riskScore ?? 0,
        },
        highlights: [],
        distanceKm: Math.round(proj.distanceKm * 10) / 10,
      };
    });

    assignHighlights(ranked);

    // Sort by a blended desirability: fit + value + convenience - risk.
    ranked.sort((a, b) => desirability(b) - desirability(a));
    return ranked;
  },
};

function desirability(r: RankedOffer): number {
  return (
    r.scores.fitScore * 0.4 +
    r.scores.valueScore * 0.3 +
    r.scores.convenienceScore * 0.3 -
    r.scores.riskScore * 0.2
  );
}

// Assign up to three highlights. Each label goes to at most one offer; a single
// offer may carry more than one (e.g. Recommended + Best Value).
function assignHighlights(ranked: RankedOffer[]): void {
  if (ranked.length === 0) return;

  const recommended = [...ranked].sort(
    (a, b) => desirability(b) - desirability(a),
  )[0]!;
  recommended.highlights.push("Recommended");

  const bestValue = [...ranked].sort(
    (a, b) => b.scores.valueScore - a.scores.valueScore,
  )[0]!;
  if (!bestValue.highlights.includes("Recommended")) {
    bestValue.highlights.push("Best Value");
  }

  const fastest = [...ranked].sort(
    (a, b) => b.scores.convenienceScore - a.scores.convenienceScore,
  )[0]!;
  if (
    !fastest.highlights.includes("Recommended") &&
    !fastest.highlights.includes("Best Value")
  ) {
    fastest.highlights.push("Fastest");
  }

  // Premium / Lower Confidence informational labels.
  for (const r of ranked) {
    if (r.scores.riskScore >= 0.6) r.highlights.push("Lower Confidence");
    const maxPrice = Math.max(...ranked.map((x) => x.offer.price));
    if (r.offer.price === maxPrice && ranked.length > 1 && r.scores.fitScore >= 0.7) {
      if (!r.highlights.includes("Recommended")) r.highlights.push("Premium");
    }
  }
}
