import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import {
  MANDATORY_FIELD_LABELS,
  MANDATORY_FIELD_HINTS,
  OPTIONAL_FIELD_LABELS,
  OPTIONAL_FIELD_HINTS,
} from "@/lib/intentDisplay";
import type { MissingFieldsResult } from "@/domain/types";

// Surfaces the deterministic missing-field detection. Mandatory blockers gate
// activation; optional suggestions only improve offer quality. Presentational
// only — detection happens in MissingFieldService on the server.
export function MissingDetails({ result }: { result: MissingFieldsResult }) {
  const { missing, optionalSuggestions } = result;
  const ready = missing.length === 0;

  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle className="text-base">
          {ready ? "Ready to go live" : "A few details still needed"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ready ? (
          <p className="text-sm text-muted-foreground">
            We have everything required to activate the market. You can still
            fine-tune the details below to get better offers.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Fill these in to activate your request:
            </p>
            <ul className="space-y-2">
              {missing.map((field) => (
                <li key={field} className="flex items-start gap-2 text-sm">
                  <span
                    aria-hidden
                    className="mt-1 h-2 w-2 shrink-0 rounded-full bg-warning"
                  />
                  <span>
                    <span className="font-medium">
                      {MANDATORY_FIELD_LABELS[field]}
                    </span>
                    <span className="text-muted-foreground">
                      {" — "}
                      {MANDATORY_FIELD_HINTS[field]}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {optionalSuggestions.length > 0 ? (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Improve your offers (optional)</p>
            <ul className="space-y-2">
              {optionalSuggestions.map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm">
                  <span
                    aria-hidden
                    className="mt-1 h-2 w-2 shrink-0 rounded-full bg-border"
                  />
                  <span>
                    <span className="font-medium">
                      {OPTIONAL_FIELD_LABELS[key] ?? key}
                    </span>
                    {OPTIONAL_FIELD_HINTS[key] ? (
                      <span className="text-muted-foreground">
                        {" — "}
                        {OPTIONAL_FIELD_HINTS[key]}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
