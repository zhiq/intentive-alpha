"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  IntentParsingService,
  IntentService,
  MarketActivationService,
} from "@/services";
import { rawIntentInputSchema } from "@/domain/schema/intent";
import { DomainError } from "@/domain/errors";

export interface ActionState {
  error?: string;
}

// Server action: parse a raw intent and route to its completion page.
export async function createIntentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const parsed = rawIntentInputSchema.safeParse({
    rawInput: formData.get("rawInput"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let intentId: string;
  try {
    const { intent } = await IntentParsingService.parseAndCreate(
      session.userId,
      parsed.data.rawInput,
    );
    intentId = intent.id;
  } catch (err) {
    return { error: toMessage(err) };
  }
  redirect(`/intents/${intentId}`);
}

export async function applyCompletionAction(
  intentId: string,
  input: unknown,
): Promise<ActionState> {
  const session = await requireSession();
  try {
    await IntentService.applyCompletion(intentId, session.userId, input);
    return {};
  } catch (err) {
    return { error: toMessage(err) };
  }
}

export async function activateIntentAction(intentId: string) {
  const session = await requireSession();
  let liveOk = false;
  try {
    await MarketActivationService.activate(intentId, session.userId);
    liveOk = true;
  } catch (err) {
    return { error: toMessage(err) };
  }
  if (liveOk) redirect(`/intents/${intentId}/live`);
}

function toMessage(err: unknown): string {
  if (err instanceof DomainError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
