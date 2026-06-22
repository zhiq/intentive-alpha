import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { IntentService, MissingFieldService } from "@/services";
import { DomainError } from "@/domain/errors";
import { Badge, Card, CardContent } from "@/components/ui/primitives";
import { IntentCard, type IntentCardData } from "@/components/intent/IntentCard";
import { MissingDetails } from "@/components/intent/MissingDetails";
import {
  INTENT_STATUS_LABELS,
  intentStatusTone,
  isIntentEditable,
} from "@/lib/intentDisplay";
import type { IntentObject } from "@prisma/client";
import type { IntentConfidence, IntentPreferences } from "@/domain/types";

// Intent Creation page: renders a parsed IntentObject as an editable Intent Card
// alongside the deterministic Missing Details detection. Edits flow through
// applyCompletionAction, which recomputes actionability and updates status.
export const dynamic = "force-dynamic";

export default async function IntentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  let intent: IntentObject;
  try {
    intent = await IntentService.getOwned(id, session.userId);
  } catch (err) {
    if (
      err instanceof DomainError &&
      (err.code === "NOT_FOUND" || err.code === "FORBIDDEN")
    ) {
      notFound();
    }
    throw err;
  }

  const missing = MissingFieldService.detect(intent);
  const editable = isIntentEditable(intent.status);
  const preferences = (intent.preferencesJson as IntentPreferences | null) ?? {};
  const confidence = intent.confidenceJson as Partial<IntentConfidence> | null;
  const ambiguityNotes = Array.isArray(confidence?.ambiguityNotes)
    ? confidence.ambiguityNotes
    : [];

  const cardData: IntentCardData = {
    id: intent.id,
    serviceType: intent.serviceType,
    requestedStartTimeISO: intent.requestedStartTime?.toISOString() ?? null,
    durationMinutes: intent.durationMinutes,
    locationText: intent.locationText,
    fulfillmentMode: intent.fulfillmentMode,
    budgetMinSen: intent.budgetMin,
    budgetMaxSen: intent.budgetMax,
    therapistGender: preferences.therapistGender ?? null,
    pressureStyle: preferences.pressureStyle ?? null,
    editable,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← New request
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Your request</h1>
            <p className="text-sm text-muted-foreground">
              You said:{" "}
              <span className="text-foreground">
                &ldquo;{intent.rawInput}&rdquo;
              </span>
            </p>
          </div>
          <Badge className={intentStatusTone(intent.status)}>
            {INTENT_STATUS_LABELS[intent.status]}
          </Badge>
        </div>
      </div>

      {ambiguityNotes.length > 0 ? (
        <Card>
          <CardContent className="space-y-1 pt-5">
            <p className="text-sm font-medium">What we weren&apos;t sure about</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {ambiguityNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <IntentCard data={cardData} highlightFields={missing.missing} />
        <div className="lg:sticky lg:top-6">
          <MissingDetails result={missing} />
        </div>
      </div>
    </div>
  );
}
