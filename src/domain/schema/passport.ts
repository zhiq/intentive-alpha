import { z } from "zod";
import { fulfillmentModeSchema, senSchema } from "./common";

// Preference Passport editable form.
export const preferencePassportSchema = z
  .object({
    preferredAreas: z.array(z.string().max(120)).max(20),
    preferredBudgetMin: senSchema.nullable(),
    preferredBudgetMax: senSchema.nullable(),
    preferredServiceStyles: z.array(z.string().max(120)).max(20),
    avoidPreferences: z.array(z.string().max(120)).max(20),
    preferredProviderGender: z.enum(["male", "female", "any"]).nullable(),
    defaultTravelRadiusKm: z.number().min(0).max(100).nullable(),
    preferredFulfillmentMode: fulfillmentModeSchema,
    notes: z.string().max(500).nullable(),
  })
  .refine(
    (p) =>
      p.preferredBudgetMin === null ||
      p.preferredBudgetMax === null ||
      p.preferredBudgetMax >= p.preferredBudgetMin,
    {
      message: "Max budget must be at least min budget",
      path: ["preferredBudgetMax"],
    },
  );
export type PreferencePassportInput = z.infer<typeof preferencePassportSchema>;
