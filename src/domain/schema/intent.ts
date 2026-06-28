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
const intentCompletionPreferencesSchema = intentPreferencesSchema.extend({
  therapistGender: z.enum(["male", "female", "any"]).nullable().optional(),
  pressureStyle: z.string().max(120).nullable().optional(),
});

export const intentCompletionSchema = z
  .object({
    serviceType: z.string().min(1).max(120).nullable().optional(),
    requestedStartTime: z.string().datetime().nullable().optional(),
    durationMinutes: z.number().int().min(15).max(600).nullable().optional(),
    locationText: z.string().min(1).max(280).nullable().optional(),
    useCurrentLocation: z.boolean().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    fulfillmentMode: fulfillmentModeSchema.optional(),
    // optional improve-offers fields
    budgetMin: senSchema.nullable().optional(),
    budgetMax: senSchema.nullable().optional(),
    travelRadiusKm: z.number().min(0).max(100).nullable().optional(),
    flexibilityTimeMinutes: z
      .number()
      .int()
      .min(0)
      .max(480)
      .nullable()
      .optional(),
    flexibilityBudgetPercent: z
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable()
      .optional(),
    flexibilityTravelKm: z.number().min(0).max(100).nullable().optional(),
    preferences: intentCompletionPreferencesSchema.optional(),
  })
  .refine(
    (data) =>
      data.budgetMin == null ||
      data.budgetMax == null ||
      data.budgetMin <= data.budgetMax,
    {
      message: "Budget minimum cannot be greater than budget maximum",
      path: ["budgetMax"],
    },
  );
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
