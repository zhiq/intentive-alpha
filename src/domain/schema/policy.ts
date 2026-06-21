import { z } from "zod";
import { addOnSchema, senSchema } from "./common";

// Provider Offer Policy settings form. Drives the autopilot's guardrails.
export const offerPolicySchema = z
  .object({
    serviceType: z.string().min(1).max(120),
    minPrice: senSchema,
    standardPrice: senSchema,
    maxDiscountPercent: z.number().int().min(0).max(90),
    allowAddOns: z.boolean(),
    allowedAddOns: z.array(addOnSchema).max(20),
    requireDeposit: z.boolean(),
    depositPercent: z.number().int().min(0).max(100),
    cancellationPolicy: z.string().min(1).max(500),
    autoSuggestEnabled: z.boolean(),
    autoSendEnabled: z.boolean(),
    maxTravelRadiusKm: z.number().min(0).max(100),
    notes: z.string().max(500).optional(),
  })
  .refine((p) => p.standardPrice >= p.minPrice, {
    message: "Standard price must be at least the minimum price",
    path: ["standardPrice"],
  });
export type OfferPolicyInput = z.infer<typeof offerPolicySchema>;
