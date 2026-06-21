// Canonical event taxonomy for observability and MarketOutcomeTrace.
// Every major state change in the market emits one of these. Keeping them in a
// single enum-like object means logs, traces, and tests speak one vocabulary.

export const MarketEvent = {
  INTENT_PARSED: "intent.parsed",
  MISSING_FIELDS_DETECTED: "intent.missing_fields_detected",
  INTENT_MARKET_ACTIONABLE: "intent.market_actionable",
  INTENT_ACTIVATED: "intent.activated",
  PROVIDERS_MATCHED: "market.providers_matched",
  PROVIDER_INVITED: "market.provider_invited",
  LOW_LIQUIDITY_WARNING: "market.low_liquidity_warning",
  OFFER_SUGGESTED: "offer.suggested",
  OFFER_APPROVED: "offer.approved",
  OFFER_EDITED: "offer.edited",
  OFFER_DECLINED: "offer.declined",
  OFFER_SENT: "offer.sent",
  OFFER_ACCEPTED: "offer.accepted",
  OFFER_REJECTED: "offer.rejected",
  BOOKING_CREATED: "booking.created",
  BOOKING_COMPLETED: "booking.completed",
  RELATIONSHIP_UPDATED: "relationship.updated",
  RELIABILITY_UPDATED: "reliability.updated",
  REQUEST_EXPIRED: "request.expired",
  REQUEST_CANCELLED: "request.cancelled",
  VALIDATION_FAILURE: "system.validation_failure",
  AI_FALLBACK_USED: "system.ai_fallback_used",
  INVALID_TRANSITION: "system.invalid_transition",
} as const;

export type MarketEventType = (typeof MarketEvent)[keyof typeof MarketEvent];
