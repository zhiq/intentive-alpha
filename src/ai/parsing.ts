import { FulfillmentMode, Urgency } from "@prisma/client";
import { ringgitToSen } from "@/lib/money";
import type { ParsedIntentDTO } from "@/domain/schema/intent";
import type { IntentConfidence } from "@/domain/types";
import type { UserContext } from "./types";
import { ALPHA_CATEGORY } from "@/domain/enums";
import { GAZETTEER } from "@/lib/geo";

// Deterministic natural-language parser for the massage/wellness alpha. This is
// the mock AI's understanding engine and the reference behavior the Claude
// provider must match in shape. Pure function — no I/O — so it is fully tested.

// Service-type detection ordered most-specific first so "deep tissue" wins over
// bare "massage".
const SERVICE_PATTERNS: { re: RegExp; type: string }[] = [
  { re: /\bdeep[-\s]?tissue\b/i, type: "Deep tissue massage" },
  { re: /\bthai\b/i, type: "Thai massage" },
  { re: /\baroma(therapy)?\b/i, type: "Aromatherapy massage" },
  { re: /\bsports?\b/i, type: "Sports massage" },
  { re: /\b(foot\s*)?reflexolog(y|ist)\b|\bfoot\s+massage\b/i, type: "Foot reflexology" },
  { re: /\brelax(ing|ation)?\b/i, type: "Relaxing massage" },
  { re: /\bspa\b/i, type: "Aromatherapy massage" },
];

export interface ParseContextOverrides {
  // Relationship-aware prefill ("same as last time").
  relationshipServiceType?: string | null;
  relationshipDurationMinutes?: number | null;
  relationshipBudgetMin?: number | null;
  relationshipBudgetMax?: number | null;
}

export function parseIntentDeterministic(
  rawInput: string,
  context: UserContext,
): ParsedIntentDTO {
  const text = rawInput.toLowerCase();
  const now = context.now;
  const ambiguityNotes: string[] = [];
  const fieldConfidence: Record<string, number> = {};

  const sameAsLast = /\bsame as last( time)?\b/.test(text);

  // --- service type ---
  let serviceType: string | null = null;
  for (const { re, type } of SERVICE_PATTERNS) {
    if (re.test(text)) {
      serviceType = type;
      fieldConfidence.serviceType = 0.9;
      break;
    }
  }
  if (!serviceType && sameAsLast && context.relationship?.usualServiceType) {
    serviceType = context.relationship.usualServiceType;
    fieldConfidence.serviceType = 0.75;
    ambiguityNotes.push(
      `Using your usual "${serviceType}" from your last booking — edit if you'd like something different.`,
    );
  }
  if (!serviceType && /\bmassage\b/.test(text)) {
    // Generic "massage" with no style — ambiguous, treat as missing.
    fieldConfidence.serviceType = 0.3;
    ambiguityNotes.push(
      "You said 'massage' but not which style — pick one to get better offers.",
    );
  }

  // --- time ---
  const { start, confidence: timeConf, note: timeNote } = parseTime(text, now);
  if (timeNote) ambiguityNotes.push(timeNote);
  if (timeConf > 0) fieldConfidence.requestedStartTime = timeConf;

  // --- duration ---
  let durationMinutes: number | null = parseDuration(text);
  if (durationMinutes) {
    fieldConfidence.durationMinutes = 0.9;
  } else if (sameAsLast && context.relationship?.usualDurationMinutes) {
    durationMinutes = context.relationship.usualDurationMinutes;
    fieldConfidence.durationMinutes = 0.7;
  }

  // --- location ---
  let locationText: string | null = null;
  for (const key of Object.keys(GAZETTEER)) {
    if (text.includes(key)) {
      locationText = GAZETTEER[key]!.label;
      fieldConfidence.location = 0.9;
      break;
    }
  }
  if (!locationText && /\bnear me\b/.test(text)) {
    // "near me" = permission to use current location.
    locationText = "near me";
    fieldConfidence.location = 0.6;
    ambiguityNotes.push(
      "We'll use your current location for 'near me' — confirm or set an area.",
    );
  }

  // --- budget ---
  let budgetMin: number | null = null;
  let budgetMax: number | null = null;
  const under = text.match(/\b(?:under|below|max|less than)\s*(?:rm)?\s*(\d{2,4})\b/i);
  const rmAmount = text.match(/\brm\s*(\d{2,4})\b/i);
  if (under) {
    budgetMax = ringgitToSen(parseInt(under[1]!, 10));
    fieldConfidence.budget = 0.85;
  } else if (rmAmount) {
    budgetMax = ringgitToSen(parseInt(rmAmount[1]!, 10));
    fieldConfidence.budget = 0.7;
  } else if (/\bnot too expensive\b|\bcheap\b|\baffordable\b/.test(text)) {
    ambiguityNotes.push(
      "You mentioned price sensitivity but no number — set a budget to filter offers.",
    );
  } else if (sameAsLast && context.relationship) {
    budgetMin = context.relationship.usualBudgetMin;
    budgetMax = context.relationship.usualBudgetMax;
  }

  // --- fulfillment mode ---
  let fulfillmentMode: FulfillmentMode = FulfillmentMode.UNKNOWN;
  if (/\b(at\s+home|home\s+service|to\s+my\s+(place|house|home)|outcall)\b/.test(text)) {
    fulfillmentMode = FulfillmentMode.HOME_SERVICE;
    fieldConfidence.fulfillmentMode = 0.85;
  } else if (/\b(in\s*store|in\s*-?\s*store|at\s+the\s+(spa|shop|outlet)|incall)\b/.test(text)) {
    fulfillmentMode = FulfillmentMode.VISIT_PROVIDER;
    fieldConfidence.fulfillmentMode = 0.85;
  }

  // --- preferences ---
  const preferences: ParsedIntentDTO["preferences"] = {};
  if (/\bfemale\b/.test(text)) preferences.therapistGender = "female";
  else if (/\bmale\b/.test(text)) preferences.therapistGender = "male";
  if (/\bhard\b/.test(text)) preferences.pressureStyle = "firm";
  else if (/\bgentle|light\b/.test(text)) preferences.pressureStyle = "gentle";
  if (/\bno hard sell\b/.test(text)) preferences.avoidPreferences = ["hard sell"];

  // Apply non-conflicting passport defaults (shown editable in the UI).
  if (context.passport) {
    if (!locationText && context.passport.preferredAreas[0]) {
      locationText = context.passport.preferredAreas[0];
      fieldConfidence.location = 0.5;
    }
    if (budgetMin === null && context.passport.preferredBudgetMin !== null) {
      budgetMin = context.passport.preferredBudgetMin;
    }
    if (budgetMax === null && context.passport.preferredBudgetMax !== null) {
      budgetMax = context.passport.preferredBudgetMax;
    }
    if (
      fulfillmentMode === FulfillmentMode.UNKNOWN &&
      context.passport.preferredFulfillmentMode &&
      context.passport.preferredFulfillmentMode !== "UNKNOWN"
    ) {
      fulfillmentMode =
        context.passport.preferredFulfillmentMode as FulfillmentMode;
      fieldConfidence.fulfillmentMode = 0.5;
    }
    if (
      !preferences.therapistGender &&
      context.passport.preferredProviderGender
    ) {
      preferences.therapistGender = context.passport
        .preferredProviderGender as "male" | "female" | "any";
    }
  }

  // --- urgency ---
  const urgency = parseUrgency(text);

  // --- derived end time ---
  let requestedEndTime: string | null = null;
  if (start && durationMinutes) {
    requestedEndTime = new Date(
      start.getTime() + durationMinutes * 60_000,
    ).toISOString();
  }

  const overall = computeOverall(fieldConfidence);
  const confidence: IntentConfidence = {
    overall,
    fields: fieldConfidence,
    ambiguityNotes,
  };

  return {
    category: ALPHA_CATEGORY,
    serviceType,
    desiredOutcome: deriveOutcome(text),
    requestedStartTime: start ? start.toISOString() : null,
    requestedEndTime,
    durationMinutes,
    locationText,
    fulfillmentMode,
    budgetMin,
    budgetMax,
    urgency,
    preferences,
    confidence,
  };
}

function deriveOutcome(text: string): string | null {
  if (/\bafter work\b/.test(text)) return "Unwind after work";
  if (/\brelax|relaxing|relaxation\b/.test(text)) return "Relaxation";
  if (/\bdeep tissue|sports|pain|sore|knot\b/.test(text)) return "Muscle relief";
  return null;
}

function parseDuration(text: string): number | null {
  const mins = text.match(/\b(\d{2,3})\s*(?:min|mins|minutes)\b/);
  if (mins) return parseInt(mins[1]!, 10);
  const hoursDecimal = text.match(/\b(\d(?:\.\d)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  if (hoursDecimal) return Math.round(parseFloat(hoursDecimal[1]!) * 60);
  return null;
}

interface TimeParse {
  start: Date | null;
  confidence: number;
  note: string | null;
}

function parseTime(text: string, now: Date): TimeParse {
  // Anchor day.
  let day = new Date(now);
  let dayConfidence = 0;
  let note: string | null = null;

  if (/\btmr\b|\btomorrow\b/.test(text)) {
    day.setDate(day.getDate() + 1);
    dayConfidence = 0.9;
  } else if (/\btoday\b|\btonight\b/.test(text)) {
    dayConfidence = 0.9;
  } else {
    const weekday = matchWeekday(text);
    if (weekday !== null) {
      day = nextWeekday(now, weekday, /\bthis\b/.test(text));
      dayConfidence = 0.85;
    }
  }

  // Anchor time of day.
  let hour: number | null = null;
  let minute = 0;
  let timeConfidence = 0;

  const clock = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (clock) {
    hour = parseInt(clock[1]!, 10) % 12;
    if (clock[3]!.toLowerCase() === "pm") hour += 12;
    minute = clock[2] ? parseInt(clock[2], 10) : 0;
    timeConfidence = 0.95;
  } else if (/\bafter work\b/.test(text)) {
    hour = 18;
    timeConfidence = 0.6;
    note = "Interpreted 'after work' as 6:00 PM — adjust if needed.";
  } else if (/\btonight\b/.test(text)) {
    hour = 20;
    timeConfidence = 0.7;
  } else if (/\bmorning\b/.test(text)) {
    hour = 9;
    timeConfidence = 0.6;
    note = "Interpreted 'morning' as 9:00 AM — adjust if needed.";
  } else if (/\bafternoon\b/.test(text)) {
    hour = 14;
    timeConfidence = 0.6;
    note = "Interpreted 'afternoon' as 2:00 PM — adjust if needed.";
  } else if (/\bevening\b/.test(text)) {
    hour = 19;
    timeConfidence = 0.6;
  }

  if (hour === null) {
    // A day was detected but no time-of-day. Set a noon placeholder so the day
    // is preserved on the Intent Card; the user adjusts the exact time there.
    if (dayConfidence > 0) {
      day.setHours(12, 0, 0, 0);
      return {
        start: day,
        confidence: 0.3,
        note: "We set a placeholder time of 12:00 PM — adjust it to your preferred time.",
      };
    }
    return { start: null, confidence: 0, note: null };
  }

  day.setHours(hour, minute, 0, 0);
  // If only a clock time was given with no day word, and it's already past,
  // assume today still (user can edit); confidence reflects the day guess.
  const confidence = Math.min(timeConfidence, dayConfidence || 0.7);
  return { start: day, confidence, note };
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function matchWeekday(text: string): number | null {
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(text)) return i;
  }
  return null;
}

function nextWeekday(now: Date, weekday: number, _thisWeek: boolean): Date {
  const d = new Date(now);
  const diff = (weekday - d.getDay() + 7) % 7;
  // "this Friday" / "Friday": next occurrence, at least 1 day out.
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return d;
}

function parseUrgency(text: string): Urgency | null {
  if (/\btonight\b|\btoday\b|\b\d{1,2}\s*(am|pm)\b/.test(text)) {
    return Urgency.SAME_DAY;
  }
  if (/\btmr\b|\btomorrow\b/.test(text)) return Urgency.TODAY;
  if (/\bthis (week|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b/.test(text)) {
    return Urgency.THIS_WEEK;
  }
  return Urgency.FLEXIBLE;
}

function computeOverall(fields: Record<string, number>): number {
  const values = Object.values(fields);
  if (values.length === 0) return 0.2;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg * 100) / 100;
}
