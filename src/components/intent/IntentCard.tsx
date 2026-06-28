"use client";

import { useActionState } from "react";
import type React from "react";
import { useFormStatus } from "react-dom";
import { IntentStatus } from "@/domain/enums";
import {
  activateIntentCardAction,
  updateIntentCardAction,
  type ActionState,
} from "@/app/actions/intent";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/primitives";
import { toAppDateTimeLocalInput } from "@/lib/dateTime";
import {
  ConfidenceNotesPanel,
  MandatoryBlockersPanel,
  OptionalSuggestionsPanel,
} from "./IntentCardPanels";
import type { IntentCardData } from "./IntentCard.types";

export function IntentCard({ intent }: { intent: IntentCardData }) {
  const updateAction = updateIntentCardAction.bind(null, intent.id);
  const [updateState, updateFormAction] = useActionState<
    ActionState,
    FormData
  >(updateAction, {});
  const activateAction = activateIntentCardAction.bind(null, intent.id);
  const [activateState, activateFormAction] = useActionState<
    ActionState,
    FormData
  >(activateAction, {});
  const canActivate = intent.status === IntentStatus.MARKET_ACTIONABLE;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Intent Card</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Review what we understood
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Correct blockers before activation. Optional fields improve offer
            quality but do not block the market.
          </p>
        </div>
        <Badge className="w-fit bg-accent text-accent-foreground">
          {intent.status.replaceAll("_", " ")}
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Your original request</CardTitle>
        </CardHeader>
        <CardContent>
          <blockquote className="rounded-md bg-muted p-4 text-sm">
            {intent.rawInput}
          </blockquote>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <form action={updateFormAction} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Editable intent object</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Service type"
                name="serviceType"
                defaultValue={intent.serviceType ?? ""}
                required={intent.missingFields.includes("serviceType")}
                confidence={fieldConfidence(intent, "serviceType")}
              />
              <Field
                label="Requested time"
                name="requestedStartTime"
                type="datetime-local"
                defaultValue={toAppDateTimeLocalInput(
                  intent.requestedStartTime,
                )}
                required={intent.missingFields.includes("requestedStartTime")}
                confidence={fieldConfidence(intent, "requestedStartTime")}
              />
              <Field
                label="Duration (minutes)"
                name="durationMinutes"
                type="number"
                min={15}
                max={600}
                defaultValue={intent.durationMinutes?.toString() ?? ""}
                required={intent.missingFields.includes("durationMinutes")}
                confidence={fieldConfidence(intent, "durationMinutes")}
              />
              <label className="space-y-1 text-sm font-medium">
                Fulfillment mode
                <select
                  name="fulfillmentMode"
                  defaultValue={intent.fulfillmentMode}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="UNKNOWN">Choose one</option>
                  <option value="HOME_SERVICE">Come to me</option>
                  <option value="VISIT_PROVIDER">I visit provider</option>
                  <option value="EITHER">Either works</option>
                </select>
                <Hint confidence={fieldConfidence(intent, "fulfillmentMode")} />
              </label>
              <Field
                className="sm:col-span-2"
                label="Location"
                name="locationText"
                defaultValue={intent.locationText ?? ""}
                required={intent.missingFields.includes("location")}
                confidence={fieldConfidence(intent, "locationText")}
              />
              <Field
                label="Latitude"
                name="latitude"
                type="number"
                step="any"
                defaultValue={intent.latitude?.toString() ?? ""}
              />
              <Field
                label="Longitude"
                name="longitude"
                type="number"
                step="any"
                defaultValue={intent.longitude?.toString() ?? ""}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Improve your offers</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Budget min (RM)"
                name="budgetMinRm"
                type="number"
                min={0}
                step="0.01"
                defaultValue={senToRmInput(intent.budgetMin)}
              />
              <Field
                label="Budget max (RM)"
                name="budgetMaxRm"
                type="number"
                min={0}
                step="0.01"
                defaultValue={senToRmInput(intent.budgetMax)}
              />
              <Field
                label="Travel radius (km)"
                name="travelRadiusKm"
                type="number"
                min={0}
                max={100}
                step="0.1"
                defaultValue={intent.travelRadiusKm?.toString() ?? ""}
              />
              <Field
                label="Time flexibility (minutes)"
                name="flexibilityTimeMinutes"
                type="number"
                min={0}
                max={480}
                defaultValue={intent.flexibilityTimeMinutes?.toString() ?? ""}
              />
              <SelectField
                label="Therapist gender"
                name="therapistGender"
                defaultValue={intent.preferences.therapistGender ?? ""}
                options={[
                  ["", "No preference"],
                  ["any", "Any"],
                  ["female", "Female"],
                  ["male", "Male"],
                ]}
              />
              <Field
                label="Pressure style"
                name="pressureStyle"
                defaultValue={intent.preferences.pressureStyle ?? ""}
              />
              {updateState.error ? (
                <p className="text-sm text-destructive sm:col-span-2">
                  {updateState.error}
                </p>
              ) : null}
              <SaveButton />
            </CardContent>
          </Card>
        </form>

        <aside className="space-y-6">
          <MandatoryBlockersPanel intent={intent} />
          <ConfidenceNotesPanel intent={intent} />
          <OptionalSuggestionsPanel intent={intent} />

          <form action={activateFormAction} className="space-y-2">
            <Button type="submit" disabled={!canActivate} className="w-full">
              Activate live market
            </Button>
            {!canActivate ? (
              <p className="text-xs text-muted-foreground">
                Resolve mandatory blockers first.
              </p>
            ) : null}
            {activateState.error ? (
              <p className="text-sm text-destructive">{activateState.error}</p>
            ) : null}
          </form>
        </aside>
      </section>
    </div>
  );
}

function Field({
  label,
  confidence,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  confidence?: number;
}) {
  return (
    <label className={`space-y-1 text-sm font-medium ${className ?? ""}`}>
      {label}
      <input
        {...props}
        className="w-full rounded-md border border-input bg-background px-3 py-2 outline-none ring-ring focus:ring-2"
      />
      <Hint confidence={confidence} />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="space-y-1 text-sm font-medium">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-input bg-background px-3 py-2"
      >
        {options.map(([value, optionLabel]) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Hint({ confidence }: { confidence?: number }) {
  return confidence === undefined ? null : (
    <span className="block text-xs text-muted-foreground">
      Confidence: {Math.round(confidence * 100)}%
    </span>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="sm:col-span-2">
      {pending ? "Saving…" : "Save Intent Card"}
    </Button>
  );
}

function fieldConfidence(intent: IntentCardData, field: string) {
  return intent.confidence.fields?.[field];
}

function senToRmInput(sen: number | null) {
  return sen === null ? "" : String(sen / 100);
}
