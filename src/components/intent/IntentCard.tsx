"use client";

import { useActionState } from "react";
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
import {
  ConfidenceNotesPanel,
  MandatoryBlockersPanel,
  OptionalSuggestionsPanel,
} from "./IntentCardPanels";
import {
  intentCardCopy,
  missingFieldSet,
} from "./IntentCard.form";
import {
  MandatoryDetailsSection,
  OptionalOfferPreferencesSection,
} from "./IntentCardFormSections";
import type { IntentCardData } from "./IntentCard.types";

export function IntentCard({ intent }: { intent: IntentCardData }) {
  const updateAction = updateIntentCardAction.bind(null, intent.id);
  const [mandatoryState, mandatoryFormAction] = useActionState<
    ActionState,
    FormData
  >(updateAction, {});
  const [optionalState, optionalFormAction] = useActionState<
    ActionState,
    FormData
  >(updateAction, {});
  const activateAction = activateIntentCardAction.bind(null, intent.id);
  const [activateState, activateFormAction] = useActionState<
    ActionState,
    FormData
  >(activateAction, {});
  const canActivate = intent.status === IntentStatus.MARKET_ACTIONABLE;
  const missingFields = missingFieldSet(intent);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Intent Card</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Review what we understood
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {intentCardCopy.headerDescription}
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
        <div className="space-y-6">
          <MandatoryDetailsSection
            intent={intent}
            missingFields={missingFields}
            action={mandatoryFormAction}
            state={mandatoryState}
          />
          <OptionalOfferPreferencesSection
            intent={intent}
            action={optionalFormAction}
            state={optionalState}
          />
        </div>

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
                {intentCardCopy.activationBlocked}
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
