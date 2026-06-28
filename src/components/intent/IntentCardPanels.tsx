import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import type { IntentCardData } from "./IntentCard.types";

const mandatoryLabels: Record<string, string> = {
  serviceType: "Service type",
  requestedStartTime: "Requested time",
  durationMinutes: "Duration",
  location: "Location",
  fulfillmentMode: "Fulfillment mode",
};

const optionalLabels: Record<string, string> = {
  budget: "Budget",
  therapistGender: "Therapist gender",
  pressureStyle: "Pressure style",
  travelRadius: "Travel radius",
  flexibility: "Flexibility",
  avoidPreferences: "Avoid preferences",
};

export function MandatoryBlockersPanel({
  intent,
}: {
  intent: IntentCardData;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mandatory blockers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {intent.missingFields.length ? (
          intent.missingFields.map((field) => (
            <StatusRow
              key={field}
              bad
              label={mandatoryLabels[field] ?? field}
              detail="Required before activation"
            />
          ))
        ) : (
          <StatusRow
            label="Ready for market"
            detail="All mandatory fields are present."
          />
        )}
      </CardContent>
    </Card>
  );
}

export function ConfidenceNotesPanel({
  intent,
}: {
  intent: IntentCardData;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confidence notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ConfidenceBar value={intent.confidence.overall} />
        {(intent.confidence.ambiguityNotes ?? []).length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {intent.confidence.ambiguityNotes?.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No ambiguity notes from parsing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function OptionalSuggestionsPanel({
  intent,
}: {
  intent: IntentCardData;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Optional suggestions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {intent.optionalSuggestions.length ? (
          intent.optionalSuggestions.map((suggestion) => (
            <Badge key={suggestion}>
              {optionalLabels[suggestion] ?? suggestion}
            </Badge>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No optional gaps detected.
          </p>
        )}
        <div className="pt-4 text-sm text-muted-foreground">
          Budget: {formatBudget(intent)}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  detail,
  bad = false,
}: {
  label: string;
  detail: string;
  bad?: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <p
        className={
          bad ? "font-medium text-destructive" : "font-medium text-success"
        }
      >
        {label}
      </p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function ConfidenceBar({ value = 0 }: { value?: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>Overall parse confidence</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function formatBudget(intent: IntentCardData) {
  if (!intent.budgetMin && !intent.budgetMax) return "Not set";
  return `${intent.budgetMin ? formatMoney(intent.budgetMin) : "Any"}–${
    intent.budgetMax ? formatMoney(intent.budgetMax) : "Any"
  }`;
}
