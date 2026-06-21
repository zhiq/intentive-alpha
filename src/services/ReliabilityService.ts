import type { Booking } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clamp } from "@/lib/utils";
import { MarketTraceService } from "./MarketTraceService";
import { MarketEvent } from "@/observability/events";

// Transparent reliability signals. We record discrete, explainable signals
// (completed booking, late cancellation, no-show) and derive a simple rolling
// score from them. NO opaque or proxy-based scoring — every signal has a named
// source the user/provider could see.
const SIGNAL_WEIGHTS: Record<string, number> = {
  booking_completed: +0.05,
  prompt_response: +0.02,
  late_cancellation: -0.1,
  no_show: -0.2,
};

export const ReliabilityService = {
  async recordCompletion(booking: Booking) {
    await this.addSignal({
      userId: booking.userId,
      signalType: "booking_completed",
      source: "booking_completion",
    });
    await this.addSignal({
      providerId: booking.providerId,
      signalType: "booking_completed",
      source: "booking_completion",
    });
  },

  async addSignal(input: {
    userId?: string;
    providerId?: string;
    signalType: string;
    source: string;
  }) {
    const value = SIGNAL_WEIGHTS[input.signalType] ?? 0;
    await prisma.reliabilitySignal.create({
      data: {
        userId: input.userId ?? null,
        providerId: input.providerId ?? null,
        signalType: input.signalType,
        signalValue: value,
        source: input.source,
      },
    });

    // Recompute provider reliabilityScore from signals (users have no stored
    // score column in alpha; their signals are summarized on demand).
    if (input.providerId) {
      await this.recomputeProviderScore(input.providerId);
    }

    await MarketTraceService.record(MarketEvent.RELIABILITY_UPDATED, {
      userId: input.userId,
      providerId: input.providerId,
      signalType: input.signalType,
      signalValue: value,
    });
  },

  async recomputeProviderScore(providerId: string) {
    const signals = await prisma.reliabilitySignal.findMany({
      where: { providerId },
    });
    const base = 0.7;
    const delta = signals.reduce((sum, s) => sum + s.signalValue, 0);
    const score = clamp(base + delta, 0, 1);
    await prisma.provider.update({
      where: { id: providerId },
      data: { reliabilityScore: Math.round(score * 100) / 100 },
    });
    return score;
  },

  /** A simple, transparent summary for a user (no hidden scoring). */
  async summarizeUser(userId: string) {
    const signals = await prisma.reliabilitySignal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    const score = clamp(
      0.7 + signals.reduce((s, x) => s + x.signalValue, 0),
      0,
      1,
    );
    return {
      score: Math.round(score * 100) / 100,
      signals,
      explanation:
        "Your reliability improves when you complete bookings, respond promptly, and avoid late cancellations. Providers may offer better terms to reliable users.",
    };
  },
};
