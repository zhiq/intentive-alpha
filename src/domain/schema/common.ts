import { z } from "zod";
import {
  FulfillmentMode,
  Urgency,
} from "@prisma/client";

// Shared primitives reused across schemas. Money is integer sen (non-negative).
export const senSchema = z.number().int().nonnegative();

export const fulfillmentModeSchema = z.nativeEnum(FulfillmentMode);
export const urgencySchema = z.nativeEnum(Urgency);

export const addOnSchema = z.object({
  name: z.string().min(1).max(120),
  price: senSchema,
  durationMinutes: z.number().int().min(0).max(600),
});
export type AddOnInput = z.infer<typeof addOnSchema>;

export const intentPreferencesSchema = z.object({
  therapistGender: z.enum(["male", "female", "any"]).optional(),
  pressureStyle: z.string().max(120).optional(),
  avoidPreferences: z.array(z.string().max(120)).max(20).optional(),
  serviceStyles: z.array(z.string().max(120)).max(20).optional(),
});
export type IntentPreferencesInput = z.infer<typeof intentPreferencesSchema>;

export const confidenceSchema = z.object({
  overall: z.number().min(0).max(1),
  fields: z.record(z.string(), z.number().min(0).max(1)),
  ambiguityNotes: z.array(z.string().max(280)).max(20),
});
