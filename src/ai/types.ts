import type { ParsedIntentDTO } from "@/domain/schema/intent";
import type {
  SuggestedOfferDTO,
  OfferBriefDTO,
  OfferRankingDTO,
} from "@/domain/schema/offer";
import type { MissingFieldsResult } from "@/domain/types";

// Context passed to the parser: who is asking, when, and what we already know
// about them. The AI uses this to resolve relative time ("today", "tmr") and to
// fill non-conflicting preferences. Never includes secrets.
export interface UserContext {
  now: Date;
  timezone: string;
  passport?: {
    preferredAreas: string[];
    preferredBudgetMin: number | null;
    preferredBudgetMax: number | null;
    preferredServiceStyles: string[];
    avoidPreferences: string[];
    preferredProviderGender: string | null;
    defaultTravelRadiusKm: number | null;
    preferredFulfillmentMode: string;
  };
  relationship?: {
    providerId: string;
    usualServiceType: string | null;
    usualDurationMinutes: number | null;
    usualBudgetMin: number | null;
    usualBudgetMax: number | null;
  } | null;
}

// Minimal projections handed to AI methods. We pass plain data, never Prisma
// models, so the AI layer has no coupling to persistence.
export interface IntentProjection {
  rawInput: string;
  category: string;
  serviceType: string | null;
  requestedStartTime: string | null;
  requestedEndTime: string | null;
  durationMinutes: number | null;
  locationText: string | null;
  fulfillmentMode: string;
  budgetMin: number | null;
  budgetMax: number | null;
  preferences: Record<string, unknown>;
}

export interface ProviderProjection {
  id: string;
  businessName: string;
  baseLocation: string;
  rating: number;
  responseTimeMinutes: number;
  offersHomeService: boolean;
  offersInStoreService: boolean;
}

export interface PolicyProjection {
  serviceType: string;
  minPrice: number;
  standardPrice: number;
  maxDiscountPercent: number;
  allowAddOns: boolean;
  allowedAddOns: { name: string; price: number; durationMinutes: number }[];
  requireDeposit: boolean;
  depositPercent: number;
  cancellationPolicy: string;
}

export interface AvailabilitySlot {
  id: string;
  startTime: string;
  endTime: string;
}

export interface OfferProjection {
  id: string;
  providerName: string;
  serviceType: string;
  startTime: string;
  durationMinutes: number;
  price: number;
  distanceKm: number;
  rating: number;
  responseTimeMinutes: number;
}

// The AI service contract. Every method returns already-validated, typed data
// (validation happens inside the provider wrapper). AI NEVER touches the DB.
export interface AiProvider {
  readonly name: "mock" | "claude";

  parseIntent(
    rawInput: string,
    context: UserContext,
  ): Promise<ParsedIntentDTO>;

  detectMissingFields(intent: IntentProjection): Promise<MissingFieldsResult>;

  generateProviderOffer(input: {
    intent: IntentProjection;
    provider: ProviderProjection;
    policy: PolicyProjection;
    slot: AvailabilitySlot;
  }): Promise<SuggestedOfferDTO>;

  generateOfferBrief(input: {
    intent: IntentProjection;
    offer: SuggestedOfferDTO;
    provider: ProviderProjection;
  }): Promise<OfferBriefDTO>;

  rankOffers(input: {
    intent: IntentProjection;
    offers: OfferProjection[];
  }): Promise<OfferRankingDTO>;

  generateUserFriendlyClarification(
    intent: IntentProjection,
    missing: MissingFieldsResult,
  ): Promise<{ message: string }>;
}
