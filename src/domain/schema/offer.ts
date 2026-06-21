import { z } from "zod";
import { addOnSchema, senSchema } from "./common";

// Output contract for the AI offer-draft step (Provider Offer Autopilot).
// The AI proposes; the service clamps to policy; the provider approves. AI
// output is validated against this before the service applies policy guards.
export const suggestedOfferSchema = z.object({
  title: z.string().min(1).max(140),
  serviceType: z.string().min(1).max(120),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(600),
  price: senSchema,
  currency: z.string().length(3).default("MYR"),
  addOns: z.array(addOnSchema).max(10).default([]),
  depositRequired: z.boolean().default(false),
  depositAmount: senSchema.default(0),
  cancellationPolicy: z.string().min(1).max(500),
  reasonedBrief: z.string().min(1).max(1200),
});
export type SuggestedOfferDTO = z.infer<typeof suggestedOfferSchema>;

// Output contract for the AI offer-brief step.
export const offerBriefSchema = z.object({
  reasonedBrief: z.string().min(1).max(1200),
});
export type OfferBriefDTO = z.infer<typeof offerBriefSchema>;

// Output contract for the AI ranking step. Returns a score set per offer id.
export const offerScoreSchema = z.object({
  offerId: z.string().min(1),
  fitScore: z.number().min(0).max(1),
  valueScore: z.number().min(0).max(1),
  convenienceScore: z.number().min(0).max(1),
  riskScore: z.number().min(0).max(1),
});
export const offerRankingSchema = z.object({
  scores: z.array(offerScoreSchema),
});
export type OfferRankingDTO = z.infer<typeof offerRankingSchema>;

// Provider edits applied to a suggested offer before sending. Bounded by policy
// in the service (price floor, etc.). All fields optional — only changed ones.
export const offerEditSchema = z.object({
  title: z.string().min(1).max(140).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(600).optional(),
  price: senSchema.optional(),
  addOns: z.array(addOnSchema).max(10).optional(),
  depositRequired: z.boolean().optional(),
  depositAmount: senSchema.optional(),
  cancellationPolicy: z.string().min(1).max(500).optional(),
  reasonedBrief: z.string().min(1).max(1200).optional(),
  providerEditNotes: z.string().max(500).optional(),
});
export type OfferEditInput = z.infer<typeof offerEditSchema>;
