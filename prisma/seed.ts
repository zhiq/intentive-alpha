import {
  PrismaClient,
  UserRole,
  FulfillmentMode,
  BookingStatus,
  OfferStatus,
  LiveIntentStatus,
  IntentStatus,
  Urgency,
} from "@prisma/client";
import { ringgitToSen } from "../src/lib/money";

const prisma = new PrismaClient();

// Deterministic-ish seed for the massage/wellness alpha across KL/PJ areas.
// Creates the three roles, five providers with services/availability/policies,
// a sample Preference Passport, and one completed booking + relationship asset
// so the "same as last time" flow has history to draw on.

function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

interface ProviderSeed {
  businessName: string;
  baseLocation: string;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  offersHomeService: boolean;
  offersInStoreService: boolean;
  rating: number;
  responseTimeMinutes: number;
  reliabilityScore: number;
  services: {
    serviceType: string;
    durationMinutes: number;
    basePrice: number; // RM
    minPrice: number;
    maxPrice: number;
  }[];
}

const PROVIDERS: ProviderSeed[] = [
  {
    businessName: "Serene Thai Wellness (KLCC)",
    baseLocation: "KLCC, Kuala Lumpur",
    latitude: 3.1578,
    longitude: 101.7117,
    serviceRadiusKm: 12,
    offersHomeService: true,
    offersInStoreService: true,
    rating: 4.7,
    responseTimeMinutes: 20,
    reliabilityScore: 0.9,
    services: [
      { serviceType: "Thai massage", durationMinutes: 120, basePrice: 180, minPrice: 150, maxPrice: 240 },
      { serviceType: "Relaxing massage", durationMinutes: 90, basePrice: 130, minPrice: 110, maxPrice: 180 },
    ],
  },
  {
    businessName: "Bangsar Deep Tissue Studio",
    baseLocation: "Bangsar, Kuala Lumpur",
    latitude: 3.1285,
    longitude: 101.6709,
    serviceRadiusKm: 10,
    offersHomeService: false,
    offersInStoreService: true,
    rating: 4.5,
    responseTimeMinutes: 35,
    reliabilityScore: 0.82,
    services: [
      { serviceType: "Deep tissue massage", durationMinutes: 90, basePrice: 160, minPrice: 140, maxPrice: 210 },
      { serviceType: "Thai massage", durationMinutes: 120, basePrice: 190, minPrice: 160, maxPrice: 250 },
    ],
  },
  {
    businessName: "Mont Kiara Aroma Spa",
    baseLocation: "Mont Kiara, Kuala Lumpur",
    latitude: 3.1726,
    longitude: 101.6509,
    serviceRadiusKm: 15,
    offersHomeService: true,
    offersInStoreService: true,
    rating: 4.8,
    responseTimeMinutes: 25,
    reliabilityScore: 0.88,
    services: [
      { serviceType: "Aromatherapy massage", durationMinutes: 90, basePrice: 170, minPrice: 150, maxPrice: 230 },
      { serviceType: "Relaxing massage", durationMinutes: 90, basePrice: 140, minPrice: 120, maxPrice: 190 },
    ],
  },
  {
    businessName: "PJ Mobile Massage Co.",
    baseLocation: "Petaling Jaya, Selangor",
    latitude: 3.1073,
    longitude: 101.6068,
    serviceRadiusKm: 20,
    offersHomeService: true,
    offersInStoreService: false,
    rating: 4.3,
    responseTimeMinutes: 45,
    reliabilityScore: 0.75,
    services: [
      { serviceType: "Thai massage", durationMinutes: 120, basePrice: 200, minPrice: 170, maxPrice: 260 },
      { serviceType: "Deep tissue massage", durationMinutes: 90, basePrice: 180, minPrice: 150, maxPrice: 220 },
    ],
  },
  {
    businessName: "Damansara Reflexology House",
    baseLocation: "Damansara, Kuala Lumpur",
    latitude: 3.1516,
    longitude: 101.6213,
    serviceRadiusKm: 10,
    offersHomeService: false,
    offersInStoreService: true,
    rating: 4.6,
    responseTimeMinutes: 30,
    reliabilityScore: 0.85,
    services: [
      { serviceType: "Foot reflexology", durationMinutes: 60, basePrice: 90, minPrice: 75, maxPrice: 130 },
      { serviceType: "Relaxing massage", durationMinutes: 90, basePrice: 125, minPrice: 105, maxPrice: 170 },
    ],
  },
];

async function main() {
  console.log("Resetting seed data…");
  // Clear in FK-safe order.
  await prisma.marketOutcomeTrace.deleteMany();
  await prisma.reliabilitySignal.deleteMany();
  await prisma.relationshipAsset.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.offerObject.deleteMany();
  await prisma.liveIntent.deleteMany();
  await prisma.intentObject.deleteMany();
  await prisma.providerAvailability.deleteMany();
  await prisma.providerOfferPolicy.deleteMany();
  await prisma.providerService.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.preferencePassport.deleteMany();
  await prisma.user.deleteMany();

  console.log("Creating users…");
  const user = await prisma.user.create({
    data: { name: "Aishah Rahman", email: "user@intentive.test", role: UserRole.USER },
  });
  const providerOwner = await prisma.user.create({
    data: { name: "Lim Wei Provider", email: "provider@intentive.test", role: UserRole.PROVIDER },
  });
  const admin = await prisma.user.create({
    data: { name: "Admin", email: "admin@intentive.test", role: UserRole.ADMIN },
  });

  console.log("Creating preference passport…");
  await prisma.preferencePassport.create({
    data: {
      userId: user.id,
      preferredAreas: ["Bangsar", "KLCC"],
      preferredBudgetMin: ringgitToSen(120),
      preferredBudgetMax: ringgitToSen(250),
      preferredServiceStyles: ["Relaxing massage", "Thai massage"],
      avoidPreferences: ["hard sell"],
      preferredProviderGender: "female",
      defaultTravelRadiusKm: 12,
      preferredFulfillmentMode: FulfillmentMode.EITHER,
      notes: "Prefers a calm environment, no upselling.",
    },
  });

  console.log("Creating providers…");
  const createdProviders = [];
  for (const p of PROVIDERS) {
    const provider = await prisma.provider.create({
      data: {
        ownerUserId: providerOwner.id,
        businessName: p.businessName,
        description: `${p.baseLocation} • rated ${p.rating}/5`,
        baseLocation: p.baseLocation,
        latitude: p.latitude,
        longitude: p.longitude,
        serviceRadiusKm: p.serviceRadiusKm,
        offersHomeService: p.offersHomeService,
        offersInStoreService: p.offersInStoreService,
        rating: p.rating,
        responseTimeMinutes: p.responseTimeMinutes,
        reliabilityScore: p.reliabilityScore,
      },
    });

    for (const s of p.services) {
      await prisma.providerService.create({
        data: {
          providerId: provider.id,
          serviceType: s.serviceType,
          durationMinutes: s.durationMinutes,
          basePrice: ringgitToSen(s.basePrice),
          minPrice: ringgitToSen(s.minPrice),
          maxPrice: ringgitToSen(s.maxPrice),
          description: `${s.serviceType} (${s.durationMinutes} min)`,
        },
      });

      await prisma.providerOfferPolicy.create({
        data: {
          providerId: provider.id,
          serviceType: s.serviceType,
          minPrice: ringgitToSen(s.minPrice),
          standardPrice: ringgitToSen(s.basePrice),
          maxDiscountPercent: 15,
          allowAddOns: true,
          allowedAddOns: [
            { name: "Hot stone add-on", price: ringgitToSen(30), durationMinutes: 15 },
            { name: "Aromatherapy oil upgrade", price: ringgitToSen(20), durationMinutes: 0 },
          ],
          requireDeposit: false,
          depositPercent: 0,
          cancellationPolicy: "Free cancellation up to 2 hours before the session.",
          autoSuggestEnabled: true,
          autoSendEnabled: false,
          maxTravelRadiusKm: p.serviceRadiusKm,
        },
      });
    }

    // Availability: a few open slots today and tomorrow (wide enough to cover
    // 2-hour requests). Each provider gets staggered windows.
    const windows = [
      { day: 0, start: 10, end: 13 },
      { day: 0, start: 14, end: 18 },
      { day: 0, start: 19, end: 22 },
      { day: 1, start: 9, end: 12 },
      { day: 1, start: 14, end: 20 },
    ];
    for (const w of windows) {
      await prisma.providerAvailability.create({
        data: {
          providerId: provider.id,
          startTime: at(w.day, w.start),
          endTime: at(w.day, w.end),
          isBooked: false,
        },
      });
    }

    createdProviders.push(provider);
  }

  console.log("Creating historical completed booking + relationship asset…");
  const histProvider = createdProviders[0]!;
  const histService = await prisma.providerService.findFirst({
    where: { providerId: histProvider.id, serviceType: "Relaxing massage" },
  });
  // A past intent that completed, to seed relationship history.
  const pastIntent = await prisma.intentObject.create({
    data: {
      userId: user.id,
      rawInput: "relaxing massage 90 mins near KLCC last week",
      serviceType: "Relaxing massage",
      requestedStartTime: at(-7, 15),
      requestedEndTime: at(-7, 16, 30),
      durationMinutes: 90,
      locationText: "KLCC",
      latitude: 3.1578,
      longitude: 101.7117,
      fulfillmentMode: FulfillmentMode.VISIT_PROVIDER,
      budgetMin: ringgitToSen(120),
      budgetMax: ringgitToSen(180),
      urgency: Urgency.FLEXIBLE,
      status: IntentStatus.ACCEPTED,
      preferencesJson: { therapistGender: "female" },
    },
  });
  const pastLive = await prisma.liveIntent.create({
    data: {
      intentObjectId: pastIntent.id,
      status: LiveIntentStatus.FULFILLED,
      providersInvitedCount: 3,
      offersReceivedCount: 2,
    },
  });
  const pastOffer = await prisma.offerObject.create({
    data: {
      liveIntentId: pastLive.id,
      providerId: histProvider.id,
      status: OfferStatus.ACCEPTED,
      title: "Relaxing massage with Serene Thai Wellness (KLCC)",
      serviceType: "Relaxing massage",
      startTime: at(-7, 15),
      endTime: at(-7, 16, 30),
      durationMinutes: 90,
      price: ringgitToSen(130),
      cancellationPolicy: "Free cancellation up to 2 hours before the session.",
      reasonedBrief: "Your usual relaxing session at your preferred studio.",
      fitScore: 0.92,
      valueScore: 0.8,
      convenienceScore: 0.85,
      riskScore: 0.1,
    },
  });
  const pastBooking = await prisma.booking.create({
    data: {
      offerObjectId: pastOffer.id,
      userId: user.id,
      providerId: histProvider.id,
      status: BookingStatus.COMPLETED,
      startTime: at(-7, 15),
      endTime: at(-7, 16, 30),
      finalPrice: ringgitToSen(130),
    },
  });
  await prisma.relationshipAsset.create({
    data: {
      userId: user.id,
      providerId: histProvider.id,
      lastBookingId: pastBooking.id,
      usualServiceType: "Relaxing massage",
      usualDurationMinutes: 90,
      usualBudgetMin: ringgitToSen(120),
      usualBudgetMax: ringgitToSen(180),
      rebookingCount: 1,
      satisfactionScore: 0.9,
      notes: "Liked the calm room and the female therapist.",
    },
  });
  // Reliability signal from the completed booking.
  await prisma.reliabilitySignal.create({
    data: {
      userId: user.id,
      signalType: "booking_completed",
      signalValue: 0.05,
      source: "seed",
    },
  });

  void histService;
  void admin;

  console.log("Seed complete:");
  console.log(`  user:     ${user.email} (${user.id})`);
  console.log(`  provider: ${providerOwner.email} (${providerOwner.id})`);
  console.log(`  admin:    ${admin.email} (${admin.id})`);
  console.log(`  providers: ${createdProviders.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
