import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/observability/logger";
import type { MarketEventType } from "@/observability/events";

type Db = PrismaClient | Prisma.TransactionClient;

// Writes audit-style MarketOutcomeTrace rows AND emits a structured log line for
// every major market event. Both happen together so the audit trail and the
// observability stream never drift. Accepts a transaction client so traces are
// committed atomically with the state change that produced them.
export const MarketTraceService = {
  async record(
    eventType: MarketEventType,
    payload: Record<string, unknown>,
    options: { intentObjectId?: string | null; db?: Db } = {},
  ): Promise<void> {
    const db = options.db ?? prisma;
    logger.event(eventType, {
      intentObjectId: options.intentObjectId ?? undefined,
      ...payload,
    });
    await db.marketOutcomeTrace.create({
      data: {
        intentObjectId: options.intentObjectId ?? null,
        eventType,
        payloadJson: payload as Prisma.InputJsonValue,
      },
    });
  },

  async listForIntent(intentObjectId: string) {
    return prisma.marketOutcomeTrace.findMany({
      where: { intentObjectId },
      orderBy: { createdAt: "asc" },
    });
  },

  async listRecent(limit = 100) {
    return prisma.marketOutcomeTrace.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
