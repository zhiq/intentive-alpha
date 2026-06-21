import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  FulfillmentMode,
  IntentStatus,
  OfferStatus,
  BookingStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ringgitToSen } from "@/lib/money";
import { ProviderMatchingService } from "@/services/ProviderMatchingService";
import { MarketActivationService } from "@/services/MarketActivationService";
import { OfferService } from "@/services/OfferService";
import { BookingService } from "@/services/BookingService";

// Integration test against the local Postgres. Creates an isolated island of
// data (unique emails), exercises the full market loop end to end, then cleans
// up. Uses the deterministic mock AI (no key in the test env).
const TAG = `flowtest_${Date.now()}`;
let userId: string;
let ownerId: string;
let providerId: string;
let slotId: string;
let intentId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Flow User", email: `${TAG}_user@test`, role: UserRole.USER },
  });
  userId = user.id;
  const owner = await prisma.user.create({
    data: {
      name: "Flow Owner",
      email: `${TAG}_owner@test`,
      role: UserRole.PROVIDER,
    },
  });
  ownerId = owner.id;

  const provider = await prisma.provider.create({
    data: {
      ownerUserId: owner.id,
      businessName: "Flow Thai Spa",
      baseLocation: "KLCC",
      latitude: 3.1578,
      longitude: 101.7117,
      serviceRadiusKm: 15,
      offersHomeService: true,
      offersInStoreService: true,
      rating: 4.6,
      responseTimeMinutes: 20,
      reliabilityScore: 0.9,
    },
  });
  providerId = provider.id;

  await prisma.providerService.create({
    data: {
      providerId,
      serviceType: "Thai massage",
      durationMinutes: 120,
      basePrice: ringgitToSen(180),
      minPrice: ringgitToSen(150),
      maxPrice: ringgitToSen(240),
    },
  });
  await prisma.providerOfferPolicy.create({
    data: {
      providerId,
      serviceType: "Thai massage",
      minPrice: ringgitToSen(150),
      standardPrice: ringgitToSen(180),
      maxDiscountPercent: 15,
      allowAddOns: false,
      allowedAddOns: [],
      requireDeposit: false,
      depositPercent: 0,
      cancellationPolicy: "Free up to 2h.",
      autoSuggestEnabled: true,
      autoSendEnabled: false,
    },
  });

  // A wide open slot covering a 2pm-today, 2h request.
  const start = new Date();
  start.setHours(10, 0, 0, 0);
  const end = new Date();
  end.setHours(22, 0, 0, 0);
  const slot = await prisma.providerAvailability.create({
    data: { providerId, startTime: start, endTime: end, isBooked: false },
  });
  slotId = slot.id;

  // A market-actionable intent for 2pm today.
  const reqStart = new Date();
  reqStart.setHours(14, 0, 0, 0);
  const intent = await prisma.intentObject.create({
    data: {
      userId,
      rawInput: "thai massage 2pm today 2 hours KLCC",
      serviceType: "Thai massage",
      requestedStartTime: reqStart,
      requestedEndTime: new Date(reqStart.getTime() + 120 * 60_000),
      durationMinutes: 120,
      locationText: "KLCC",
      latitude: 3.1578,
      longitude: 101.7117,
      fulfillmentMode: FulfillmentMode.VISIT_PROVIDER,
      budgetMax: ringgitToSen(220),
      status: IntentStatus.MARKET_ACTIONABLE,
    },
  });
  intentId = intent.id;
});

afterAll(async () => {
  // Clean up the island (FK-safe order). Traces reference intent via SetNull.
  await prisma.marketOutcomeTrace.deleteMany({
    where: { intentObjectId: intentId },
  });
  await prisma.reliabilitySignal.deleteMany({
    where: { OR: [{ userId }, { providerId }] },
  });
  await prisma.relationshipAsset.deleteMany({ where: { userId } });
  await prisma.booking.deleteMany({ where: { userId } });
  await prisma.offerObject.deleteMany({ where: { providerId } });
  await prisma.liveIntent.deleteMany({
    where: { intentObject: { userId } },
  });
  await prisma.intentObject.deleteMany({ where: { userId } });
  await prisma.providerAvailability.deleteMany({ where: { providerId } });
  await prisma.providerOfferPolicy.deleteMany({ where: { providerId } });
  await prisma.providerService.deleteMany({ where: { providerId } });
  await prisma.provider.deleteMany({ where: { id: providerId } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, ownerId] } } });
  await prisma.$disconnect();
});

describe("market flow (integration)", () => {
  it("matches the eligible provider for the intent", async () => {
    const intent = await prisma.intentObject.findUniqueOrThrow({
      where: { id: intentId },
    });
    const eligible = await ProviderMatchingService.findEligible(intent);
    expect(eligible.map((e) => e.provider.id)).toContain(providerId);
    const me = eligible.find((e) => e.provider.id === providerId)!;
    expect(me.candidate.matchScore).toBeGreaterThan(0.5);
  });

  it("activates, generates a policy-respecting suggested offer, and books", async () => {
    const result = await MarketActivationService.activate(intentId, userId);
    expect(result.providersInvited).toBeGreaterThanOrEqual(1);
    expect(result.offersGenerated).toBeGreaterThanOrEqual(1);

    // Suggested offer respects the policy floor and standard price band.
    const suggested = await prisma.offerObject.findFirstOrThrow({
      where: { providerId, status: OfferStatus.SUGGESTED },
    });
    expect(suggested.price).toBeGreaterThanOrEqual(ringgitToSen(150));
    expect(suggested.price).toBeLessThanOrEqual(ringgitToSen(180));

    // Provider approves + sends (no auto-send in alpha).
    await OfferService.approveAndSend(suggested.id, ownerId);
    const sent = await prisma.offerObject.findUniqueOrThrow({
      where: { id: suggested.id },
    });
    expect(sent.status).toBe(OfferStatus.SENT);

    // Intent should now be OFFER_READY.
    const afterSend = await prisma.intentObject.findUniqueOrThrow({
      where: { id: intentId },
    });
    expect(afterSend.status).toBe(IntentStatus.OFFER_READY);

    // User accepts → booking created, slot booked, intent ACCEPTED.
    const booking = await BookingService.acceptOffer(sent.id, userId);
    expect(booking.status).toBe(BookingStatus.CONFIRMED);

    const slot = await prisma.providerAvailability.findUniqueOrThrow({
      where: { id: slotId },
    });
    expect(slot.isBooked).toBe(true);

    const acceptedIntent = await prisma.intentObject.findUniqueOrThrow({
      where: { id: intentId },
    });
    expect(acceptedIntent.status).toBe(IntentStatus.ACCEPTED);

    // Completion creates the relationship asset + reliability signals.
    const completed = await BookingService.markCompleted(booking.id, {
      userId: ownerId,
      isAdmin: false,
    });
    expect(completed.status).toBe(BookingStatus.COMPLETED);

    const rel = await prisma.relationshipAsset.findUniqueOrThrow({
      where: { userId_providerId: { userId, providerId } },
    });
    expect(rel.usualServiceType).toBe("Thai massage");
    expect(rel.usualDurationMinutes).toBe(120);

    const signals = await prisma.reliabilitySignal.findMany({
      where: { userId },
    });
    expect(signals.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects accepting an already-accepted offer", async () => {
    const accepted = await prisma.offerObject.findFirstOrThrow({
      where: { providerId, status: OfferStatus.ACCEPTED },
    });
    await expect(
      BookingService.acceptOffer(accepted.id, userId),
    ).rejects.toThrow();
  });
});
