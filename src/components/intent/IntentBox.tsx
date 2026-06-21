"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createIntentAction, type ActionState } from "@/app/actions/intent";
import { Button } from "@/components/ui/primitives";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Reading your intent…" : "Create live request"}
    </Button>
  );
}

export function IntentBox({ examples }: { examples: string[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createIntentAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <textarea
        name="rawInput"
        rows={3}
        required
        placeholder="e.g. 2pm today free Thai massage 2 hours near me"
        className="w-full resize-none rounded-md border border-input bg-background px-4 py-3 text-base outline-none ring-ring focus:ring-2"
      />
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <ExampleChip key={ex} text={ex} />
          ))}
        </div>
        <SubmitButton />
      </div>
    </form>
  );
}

function ExampleChip({ text }: { text: string }) {
  // Clicking an example fills the textarea (progressive enhancement; the form
  // still works without JS via the textarea + submit).
  return (
    <button
      type="button"
      onClick={(e) => {
        const form = e.currentTarget.closest("form");
        const ta = form?.querySelector<HTMLTextAreaElement>(
          "textarea[name=rawInput]",
        );
        if (ta) {
          ta.value = text;
          ta.focus();
        }
      }}
      className="rounded-full border bg-secondary px-3 py-1 text-xs text-secondary-foreground hover:bg-muted"
    >
      {text}
    </button>
  );
}
