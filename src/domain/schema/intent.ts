import { z } from "zod";
import {
  fulfillmentModeSchema,
  urgencySchema,
  intentPreferencesSchema,
  confidenceSchema,
  senSchema,
} from "./common";
import { FulfillmentMode } from "@prisma/client";

// Raw user input from the intent box.
export const rawIntentInputSchema = z.object({
  rawInput: z.string().min(2, "Tell us what you need").max(1000),
});
export type RawIntentInput = z.infer<typeof rawIntentInputSchema>;

// Output contract for the AI parse step. AI must return JSON matching this
// shape; it is validated before any persistence. ISO datetime strings are used
// on the wire and converted to Date in the service layer.
export const parsedIntentSchema = z.object({
  category: z.string().min(1),
  serviceType: z.string().min(1).nullable(),
  desiredOutcome: z.string().max(280).nullable(),
  requestedStartTime: z.string().datetime().nullable(),
  requestedEndTime: z.string().datetime().nullable(),
  durationMinutes: z.number().int().min(15).max(600).nullable(),
  locationText: z.string().max(280).nullable(),
  fulfillmentMode: fulfillmentModeSchema,
  budgetMin: senSchema.nullable(),
  budgetMax: senSchema.nullable(),
  urgency: urgencySchema.nullable(),
  preferences: intentPreferencesSchema,
  confidence: confidenceSchema,
});
export type ParsedIntentDTO = z.infer<typeof parsedIntentSchema>;

// The structured completion form for mandatory blockers. Submitted by the user
// on the Intent Creation page. Optional "improve your offers" fields are
// included but never required by the activation gate.
export const intentCompletionSchema = z.object({
  serviceType: z.string().min(1).max(120).optional(),
  requestedStartTime: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(600).optional(),
  locationText: z.string().min(1).max(280).optional(),
  useCurrentLocation: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  fulfillmentMode: fulfillmentModeSchema.optional(),
  // optional improve-offers fields
  budgetMin: senSchema.optional(),
  budgetMax: senSchema.optional(),
  travelRadiusKm: z.number().min(0).max(100).optional(),
  flexibilityTimeMinutes: z.number().int().min(0).max(480).optional(),
  flexibilityBudgetPercent: z.number().int().min(0).max(100).optional(),
  flexibilityTravelKm: z.number().min(0).max(100).optional(),
  preferences: intentPreferencesSchema.optional(),
});
export type IntentCompletionInput = z.infer<typeof intentCompletionSchema>;

// A normalized intent snapshot used by missing-field detection and matching.
// Mirrors the persisted fields that matter to the market.
export const marketIntentSnapshotSchema = z.object({
  serviceType: z.string().nullable(),
  requestedStartTime: z.coerce.date().nullable(),
  requestedEndTime: z.coerce.date().nullable(),
  durationMinutes: z.number().int().nullable(),
  locationText: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  fulfillmentMode: fulfillmentModeSchema.default(FulfillmentMode.UNKNOWN),
  budgetMin: z.number().int().nullable(),
  budgetMax: z.number().int().nullable(),
});
export type MarketIntentSnapshot = z.infer<typeof marketIntentSnapshotSchema>;
