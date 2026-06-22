"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FulfillmentMode } from "@prisma/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/primitives";
import { applyCompletionAction } from "@/app/actions/intent";
import { ringgitToSen, senToRinggit } from "@/lib/money";
import { FULFILLMENT_MODE_LABELS } from "@/lib/intentDisplay";
import { MASSAGE_SERVICE_TYPES, type MandatoryField } from "@/domain/enums";

// Plain, serializable snapshot of an IntentObject passed from the server page to
// this client form. Money is sen; time is an ISO-8601 UTC string.
export interface IntentCardData {
  id: string;
  serviceType: string | null;
  desiredOutcome: string | null;
  requestedStartTimeISO: string | null;
  durationMinutes: number | null;
  locationText: string | null;
  fulfillmentMode: FulfillmentMode;
  budgetMinSen: number | null;
  budgetMaxSen: number | null;
  therapistGender: string | null;
  pressureStyle: string | null;
  editable: boolean;
}

interface FormState {
  serviceType: string;
  requestedStartTime: string; // datetime-local value (browser local time)
  durationMinutes: string;
  locationText: string;
  fulfillmentMode: FulfillmentMode;
  budgetMin: string; // RM
  budgetMax: string; // RM
  therapistGender: string;
  pressureStyle: string;
}

const FULFILLMENT_OPTIONS: FulfillmentMode[] = [
  FulfillmentMode.HOME_SERVICE,
  FulfillmentMode.VISIT_PROVIDER,
  FulfillmentMode.EITHER,
  FulfillmentMode.UNKNOWN,
];

const DURATION_PRESETS = [30, 45, 60, 90, 120, 150, 180];

const MISSING_FIELD_TO_INPUT: Record<MandatoryField, string> = {
  serviceType: "serviceType",
  requestedStartTime: "requestedStartTime",
  durationMinutes: "durationMinutes",
  location: "locationText",
  fulfillmentMode: "fulfillmentMode",
};

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function senToRinggitInput(sen: number | null): string {
  return sen === null ? "" : String(senToRinggit(sen));
}

function initialState(data: IntentCardData): FormState {
  return {
    serviceType: data.serviceType ?? "",
    requestedStartTime: isoToLocalInput(data.requestedStartTimeISO),
    durationMinutes: data.durationMinutes === null ? "" : String(data.durationMinutes),
    locationText: data.locationText ?? "",
    fulfillmentMode: data.fulfillmentMode,
    budgetMin: senToRinggitInput(data.budgetMinSen),
    budgetMax: senToRinggitInput(data.budgetMaxSen),
    therapistGender: data.therapistGender ?? "",
    pressureStyle: data.pressureStyle ?? "",
  };
}

export function IntentCard({
  data,
  highlightFields = [],
}: {
  data: IntentCardData;
  highlightFields?: MandatoryField[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(data));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const highlighted = new Set(
    highlightFields.map((f) => MISSING_FIELD_TO_INPUT[f]),
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function buildInput(): Record<string, unknown> {
    const input: Record<string, unknown> = {};

    const serviceType = form.serviceType.trim();
    if (serviceType) input.serviceType = serviceType;

    const iso = localInputToIso(form.requestedStartTime);
    if (iso) input.requestedStartTime = iso;

    const duration = Number(form.durationMinutes);
    if (form.durationMinutes !== "" && Number.isFinite(duration)) {
      input.durationMinutes = Math.round(duration);
    }

    const location = form.locationText.trim();
    if (location) input.locationText = location;

    // Always send the chosen mode (an explicit UNKNOWN is meaningful: it keeps
    // fulfillment flagged as a blocker rather than silently retaining a prior value).
    input.fulfillmentMode = form.fulfillmentMode;

    const budgetMin = Number(form.budgetMin);
    if (form.budgetMin !== "" && Number.isFinite(budgetMin) && budgetMin >= 0) {
      input.budgetMin = ringgitToSen(budgetMin);
    }
    const budgetMax = Number(form.budgetMax);
    if (form.budgetMax !== "" && Number.isFinite(budgetMax) && budgetMax >= 0) {
      input.budgetMax = ringgitToSen(budgetMax);
    }

    const preferences: Record<string, unknown> = {};
    if (form.therapistGender) preferences.therapistGender = form.therapistGender;
    const pressure = form.pressureStyle.trim();
    if (pressure) preferences.pressureStyle = pressure;
    if (Object.keys(preferences).length > 0) input.preferences = preferences;

    return input;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data.editable || pending) return;
    setError(null);
    setSaved(false);

    if (form.budgetMin && form.budgetMax) {
      const min = Number(form.budgetMin);
      const max = Number(form.budgetMax);
      if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
        setError("Minimum budget can't be greater than the maximum.");
        return;
      }
    }

    const input = buildInput();
    startTransition(async () => {
      const res = await applyCompletionAction(data.id, input);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
      // Re-render the server page so status and missing-details refresh.
      router.refresh();
    });
  }

  const fieldClass = (name: string) =>
    `w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2 ${
      highlighted.has(name) ? "border-warning" : "border-input"
    }`;

  const fieldset = data.editable ? undefined : true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Intent Card</CardTitle>
        <p className="text-sm text-muted-foreground">
          Review and edit what we understood. Changes are saved to your request.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <fieldset disabled={fieldset} className="space-y-5">
            <Field
              label="Service type"
              hint="What kind of massage?"
              highlighted={highlighted.has("serviceType")}
            >
              <input
                list="service-type-options"
                value={form.serviceType}
                onChange={(e) => set("serviceType", e.target.value)}
                placeholder="e.g. Thai massage"
                className={fieldClass("serviceType")}
              />
              <datalist id="service-type-options">
                {MASSAGE_SERVICE_TYPES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Preferred start time"
                highlighted={highlighted.has("requestedStartTime")}
              >
                <input
                  type="datetime-local"
                  value={form.requestedStartTime}
                  onChange={(e) => set("requestedStartTime", e.target.value)}
                  className={fieldClass("requestedStartTime")}
                />
              </Field>

              <Field
                label="Duration (minutes)"
                highlighted={highlighted.has("durationMinutes")}
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min={15}
                  max={600}
                  step={15}
                  list="duration-options"
                  value={form.durationMinutes}
                  onChange={(e) => set("durationMinutes", e.target.value)}
                  placeholder="e.g. 90"
                  className={fieldClass("durationMinutes")}
                />
                <datalist id="duration-options">
                  {DURATION_PRESETS.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </Field>
            </div>

            <Field
              label="Location"
              hint="Area or address to match nearby providers."
              highlighted={highlighted.has("locationText")}
            >
              <input
                value={form.locationText}
                onChange={(e) => set("locationText", e.target.value)}
                placeholder="e.g. near KLCC"
                className={fieldClass("locationText")}
              />
            </Field>

            <Field
              label="Where it happens"
              highlighted={highlighted.has("fulfillmentMode")}
            >
              <select
                value={form.fulfillmentMode}
                onChange={(e) =>
                  set("fulfillmentMode", e.target.value as FulfillmentMode)
                }
                className={fieldClass("fulfillmentMode")}
              >
                {FULFILLMENT_OPTIONS.map((mode) => (
                  <option key={mode} value={mode}>
                    {FULFILLMENT_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </Field>

            <div className="space-y-4 rounded-md border bg-muted p-4">
              <p className="text-sm font-medium">Improve your offers (optional)</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Budget min (RM)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={10}
                    value={form.budgetMin}
                    onChange={(e) => set("budgetMin", e.target.value)}
                    placeholder="e.g. 100"
                    className={fieldClass("budgetMin")}
                  />
                </Field>
                <Field label="Budget max (RM)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={10}
                    value={form.budgetMax}
                    onChange={(e) => set("budgetMax", e.target.value)}
                    placeholder="e.g. 250"
                    className={fieldClass("budgetMax")}
                  />
                </Field>
                <Field label="Therapist gender preference">
                  <select
                    value={form.therapistGender}
                    onChange={(e) => set("therapistGender", e.target.value)}
                    className={fieldClass("therapistGender")}
                  >
                    <option value="">No preference</option>
                    <option value="any">Any</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </Field>
                <Field label="Pressure / style">
                  <input
                    value={form.pressureStyle}
                    onChange={(e) => set("pressureStyle", e.target.value)}
                    placeholder="e.g. firm, focus on shoulders"
                    className={fieldClass("pressureStyle")}
                  />
                </Field>
              </div>
            </div>
          </fieldset>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {data.editable ? (
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
              {saved && !pending ? (
                <span className="text-sm text-success" role="status">
                  Saved
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This request can no longer be edited.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  highlighted = false,
  children,
}: {
  label: string;
  hint?: string;
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-2 text-sm font-medium">
        {label}
        {highlighted ? (
          <span className="rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground">
            Needed
          </span>
        ) : null}
      </span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
