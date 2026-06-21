// Domain enums. We re-export the Prisma-generated enums so the rest of the app
// imports its vocabulary from the domain layer, not from the ORM. This keeps a
// single seam to change if persistence ever moves off Prisma.

export {
  UserRole,
  FulfillmentMode,
  IntentStatus,
  LiveIntentStatus,
  OfferStatus,
  BookingStatus,
  Urgency,
} from "@prisma/client";

// The alpha vertical.
export const ALPHA_CATEGORY = "massage_wellness" as const;

// Mandatory blockers for the massage/wellness category. These — and only these —
// gate activation. Everything else lives under "Improve your offers".
export const MASSAGE_MANDATORY_FIELDS = [
  "serviceType",
  "requestedStartTime",
  "durationMinutes",
  "location",
  "fulfillmentMode",
] as const;

export type MandatoryField = (typeof MASSAGE_MANDATORY_FIELDS)[number];

// Optional fields that improve offer quality but never block activation.
export const MASSAGE_OPTIONAL_FIELDS = [
  "budget",
  "therapistGender",
  "pressureStyle",
  "travelRadius",
  "flexibility",
  "avoidPreferences",
] as const;

export type OptionalField = (typeof MASSAGE_OPTIONAL_FIELDS)[number];

// Known service types for the alpha vertical (used by mock parser + matching).
export const MASSAGE_SERVICE_TYPES = [
  "Thai massage",
  "Relaxing massage",
  "Deep tissue massage",
  "Aromatherapy massage",
  "Sports massage",
  "Foot reflexology",
] as const;

// Market defaults.
export const DEFAULT_INTENT_TTL_MINUTES = 120;
export const MAX_PROVIDERS_INVITED = 5;
export const MIN_PROVIDERS_INVITED = 3;
export const LOW_LIQUIDITY_THRESHOLD = 2;
export const MIN_PROVIDER_RELIABILITY = 0.4;
