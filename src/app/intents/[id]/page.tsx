import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { IntentService } from "@/services";
import { MissingFieldService } from "@/services/MissingFieldService";
import { DomainError } from "@/domain/errors";
import { IntentCard } from "@/components/intent/IntentCard";
import type { IntentCardData } from "@/components/intent/IntentCard.types";

export default async function IntentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  try {
    const intent = await IntentService.getOwned(id, session.userId);
    const missing = await MissingFieldService.detect(intent);
    const data: IntentCardData = {
      id: intent.id,
      rawInput: intent.rawInput,
      status: intent.status,
      category: intent.category,
      serviceType: intent.serviceType,
      desiredOutcome: intent.desiredOutcome,
      requestedStartTime: intent.requestedStartTime?.toISOString() ?? null,
      requestedEndTime: intent.requestedEndTime?.toISOString() ?? null,
      durationMinutes: intent.durationMinutes,
      locationText: intent.locationText,
      latitude: intent.latitude,
      longitude: intent.longitude,
      fulfillmentMode: intent.fulfillmentMode,
      budgetMin: intent.budgetMin,
      budgetMax: intent.budgetMax,
      travelRadiusKm: intent.travelRadiusKm,
      flexibilityTimeMinutes: intent.flexibilityTimeMinutes,
      flexibilityBudgetPercent: intent.flexibilityBudgetPercent,
      flexibilityTravelKm: intent.flexibilityTravelKm,
      preferences: (intent.preferencesJson as IntentCardData["preferences"]) ?? {},
      confidence: (intent.confidenceJson as IntentCardData["confidence"]) ?? {},
      missingFields: missing.missing,
      optionalSuggestions: missing.optionalSuggestions,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString(),
    };
    return <IntentCard intent={data} />;
  } catch (err) {
    if (err instanceof DomainError && (err.code === "NOT_FOUND" || err.code === "FORBIDDEN")) notFound();
    throw err;
  }
}
