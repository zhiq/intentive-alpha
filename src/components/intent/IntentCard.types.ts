import type { FulfillmentMode, IntentStatus } from "@/domain/enums";

export type IntentConfidence = {
  overall?: number;
  fields?: Record<string, number>;
  ambiguityNotes?: string[];
};

export type IntentPreferencesView = {
  therapistGender?: string;
  pressureStyle?: string;
  avoidPreferences?: string[];
  serviceStyles?: string[];
};

export interface IntentCardData {
  id: string;
  rawInput: string;
  status: IntentStatus;
  category: string;
  serviceType: string | null;
  desiredOutcome: string | null;
  requestedStartTime: string | null;
  requestedEndTime: string | null;
  durationMinutes: number | null;
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  fulfillmentMode: FulfillmentMode;
  budgetMin: number | null;
  budgetMax: number | null;
  travelRadiusKm: number | null;
  flexibilityTimeMinutes: number | null;
  flexibilityBudgetPercent: number | null;
  flexibilityTravelKm: number | null;
  preferences: IntentPreferencesView;
  confidence: IntentConfidence;
  missingFields: string[];
  optionalSuggestions: string[];
  createdAt: string;
  updatedAt: string;
}
