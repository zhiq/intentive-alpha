import type { MandatoryField } from "./enums";
import type { FulfillmentMode, Urgency } from "@prisma/client";

// Shared domain value types used across services, AI, and validation.
// These are plain data shapes (no methods); behavior lives in services.

/** Per-field parse confidence and ambiguity notes surfaced on the Intent Card. */
export interface IntentConfidence {
  overall: number; // 0..1
  fields: Record<string, number>; // field -> 0..1
  ambiguityNotes: string[];
}

/** Add-on attached to a policy or an offer. */
export interface AddOn {
  name: string;
  price: number; // sen
  durationMinutes: number;
}

/** Structured preferences carried on an Intent Object (preferencesJson). */
export interface IntentPreferences {
  therapistGender?: "male" | "female" | "any";
  pressureStyle?: string;
  avoidPreferences?: string[];
  serviceStyles?: string[];
}

/** Result of missing-field detection. */
export interface MissingFieldsResult {
  missing: MandatoryField[];
  optionalSuggestions: string[];
}

/** Normalized parse result the AI layer must produce (pre-persistence). */
export interface ParsedIntent {
  category: string;
  serviceType: string | null;
  desiredOutcome: string | null;
  requestedStartTime: string | null; // ISO 8601
  requestedEndTime: string | null; // ISO 8601
  durationMinutes: number | null;
  locationText: string | null;
  fulfillmentMode: FulfillmentMode;
  budgetMin: number | null; // sen
  budgetMax: number | null; // sen
  urgency: Urgency | null;
  preferences: IntentPreferences;
  confidence: IntentConfidence;
}

/** A scored, eligible provider produced by ProviderMatchingService. */
export interface MatchCandidate {
  providerId: string;
  matchScore: number; // 0..1
  breakdown: {
    serviceMatch: number;
    timeMatch: number;
    distanceMatch: number;
    ratingMatch: number;
    responseMatch: number;
    priceFit: number;
    preferenceFit: number;
    availabilityConfidence: number;
  };
  matchedAvailabilityId: string | null;
  distanceKm: number;
}

/** The four scores shown on every offer card. */
export interface OfferScores {
  fitScore: number;
  valueScore: number;
  convenienceScore: number;
  riskScore: number;
}

export type OfferHighlight =
  | "Recommended"
  | "Best Value"
  | "Fastest"
  | "Premium"
  | "Lower Confidence";
