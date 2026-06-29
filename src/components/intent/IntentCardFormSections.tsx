"use client";

import type React from "react";
import { useFormStatus } from "react-dom";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { toAppDateTimeLocalInput } from "@/lib/dateTime";
import type { ActionState } from "@/app/actions/intent";
import type { IntentCardData } from "./IntentCard.types";
import {
  fieldConfidence,
  fulfillmentModeFormValue,
  fulfillmentModeOptions,
  intentCardCopy,
  senToRmInput,
  type MissingFieldKey,
} from "./IntentCard.form";

export function MandatoryDetailsSection({
  intent,
  missingFields,
  action,
  state,
}: {
  intent: IntentCardData;
  missingFields: ReadonlySet<MissingFieldKey>;
  action: (formData: FormData) => void;
  state: ActionState;
}) {
  const missing = (field: MissingFieldKey) => missingFields.has(field);

  return (
    <form action={action} className="space-y-4">
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-destructive">
            {intentCardCopy.mandatoryEyebrow}
          </p>
          <CardTitle>{intentCardCopy.mandatoryTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {intentCardCopy.mandatoryDescription}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <IntentTextField
            label="Service type"
            name="serviceType"
            defaultValue={intent.serviceType ?? ""}
            requiredForActivation={missing("serviceType")}
            confidence={fieldConfidence(intent, "serviceType")}
          />
          <IntentTextField
            label="Requested time"
            name="requestedStartTime"
            type="datetime-local"
            defaultValue={toAppDateTimeLocalInput(intent.requestedStartTime)}
            requiredForActivation={missing("requestedStartTime")}
            confidence={fieldConfidence(intent, "requestedStartTime")}
          />
          <IntentTextField
            label="Duration (minutes)"
            name="durationMinutes"
            type="number"
            min={15}
            max={600}
            defaultValue={intent.durationMinutes?.toString() ?? ""}
            requiredForActivation={missing("durationMinutes")}
            confidence={fieldConfidence(intent, "durationMinutes")}
          />
          <IntentSelectField
            label="Fulfillment mode"
            name="fulfillmentMode"
            defaultValue={fulfillmentModeFormValue(intent.fulfillmentMode)}
            requiredForActivation={missing("fulfillmentMode")}
            confidence={fieldConfidence(intent, "fulfillmentMode")}
            placeholder="Choose one"
            options={fulfillmentModeOptions}
          />
          <IntentTextField
            className="sm:col-span-2"
            label="Location"
            name="locationText"
            defaultValue={intent.locationText ?? ""}
            requiredForActivation={missing("location")}
            confidence={fieldConfidence(intent, "locationText")}
          />
          <IntentTextField
            label="Latitude"
            name="latitude"
            type="number"
            step="any"
            defaultValue={intent.latitude?.toString() ?? ""}
          />
          <IntentTextField
            label="Longitude"
            name="longitude"
            type="number"
            step="any"
            defaultValue={intent.longitude?.toString() ?? ""}
          />
          <FormStateMessage state={state} successLabel="Required details saved." />
          <SaveButton label="Save required details" />
        </CardContent>
      </Card>
    </form>
  );
}

export function OptionalOfferPreferencesSection({
  intent,
  action,
  state,
}: {
  intent: IntentCardData;
  action: (formData: FormData) => void;
  state: ActionState;
}) {
  return (
    <form action={action} className="space-y-4">
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-primary">
            {intentCardCopy.optionalEyebrow}
          </p>
          <CardTitle>{intentCardCopy.optionalTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {intentCardCopy.optionalDescription}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <IntentTextField
            label="Budget min (RM)"
            name="budgetMinRm"
            type="number"
            min={0}
            step="0.01"
            defaultValue={senToRmInput(intent.budgetMin)}
          />
          <IntentTextField
            label="Budget max (RM)"
            name="budgetMaxRm"
            type="number"
            min={0}
            step="0.01"
            defaultValue={senToRmInput(intent.budgetMax)}
          />
          <IntentTextField
            label="Travel radius (km)"
            name="travelRadiusKm"
            type="number"
            min={0}
            max={100}
            step="0.1"
            defaultValue={intent.travelRadiusKm?.toString() ?? ""}
          />
          <IntentTextField
            label="Time flexibility (minutes)"
            name="flexibilityTimeMinutes"
            type="number"
            min={0}
            max={480}
            defaultValue={intent.flexibilityTimeMinutes?.toString() ?? ""}
          />
          <IntentSelectField
            label="Therapist gender"
            name="therapistGender"
            defaultValue={intent.preferences.therapistGender ?? ""}
            placeholder="No preference"
            options={[
              ["any", "Any"],
              ["female", "Female"],
              ["male", "Male"],
            ]}
          />
          <IntentTextField
            label="Pressure style"
            name="pressureStyle"
            defaultValue={intent.preferences.pressureStyle ?? ""}
          />
          <FormStateMessage state={state} successLabel="Offer preferences saved." />
          <SaveButton label="Save offer preferences" />
        </CardContent>
      </Card>
    </form>
  );
}

function IntentTextField({
  label,
  confidence,
  className,
  requiredForActivation = false,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  confidence?: number;
  requiredForActivation?: boolean;
}) {
  return (
    <FormControl
      label={label}
      className={className}
      confidence={confidence}
      requiredForActivation={requiredForActivation}
    >
      <input
        {...props}
        required={requiredForActivation}
        className="w-full rounded-md border border-input bg-background px-3 py-2 outline-none ring-ring focus:ring-2"
      />
    </FormControl>
  );
}

function IntentSelectField<T extends string>({
  label,
  name,
  defaultValue,
  options,
  placeholder,
  confidence,
  requiredForActivation = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: ReadonlyArray<readonly [T, string]>;
  placeholder: string;
  confidence?: number;
  requiredForActivation?: boolean;
}) {
  return (
    <FormControl
      label={label}
      confidence={confidence}
      requiredForActivation={requiredForActivation}
    >
      <select
        name={name}
        defaultValue={defaultValue}
        required={requiredForActivation}
        className="w-full rounded-md border border-input bg-background px-3 py-2"
      >
        <option value="">{placeholder}</option>
        {options.map(([value, optionLabel]) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </FormControl>
  );
}

function FormControl({
  label,
  className,
  confidence,
  requiredForActivation,
  children,
}: {
  label: string;
  className?: string;
  confidence?: number;
  requiredForActivation?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`space-y-1 text-sm font-medium ${className ?? ""}`}>
      <span>
        {label}
        {requiredForActivation ? <ActivationRequiredBadge /> : null}
      </span>
      {children}
      <Hint confidence={confidence} />
    </label>
  );
}

function ActivationRequiredBadge() {
  return (
    <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
      <span aria-hidden="true">Required</span>
      <span className="sr-only">Required before activation</span>
    </span>
  );
}

function Hint({ confidence }: { confidence?: number }) {
  return confidence === undefined ? null : (
    <span className="block text-xs text-muted-foreground">
      Confidence: {Math.round(confidence * 100)}%
    </span>
  );
}

function FormStateMessage({
  state,
  successLabel,
}: {
  state: ActionState;
  successLabel: string;
}) {
  if (state.error) {
    return <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>;
  }
  if (!state.ok) return null;

  const remaining = state.remainingBlockers?.length ?? 0;
  return (
    <p className="text-sm text-success sm:col-span-2">
      {remaining > 0
        ? `${successLabel} ${remaining} mandatory ${remaining === 1 ? "blocker remains" : "blockers remain"}.`
        : `${successLabel} All mandatory blockers are resolved.`}
    </p>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="sm:col-span-2">
      {pending ? "Saving…" : label}
    </Button>
  );
}
