import { describe, it, expect } from "vitest";
import { parseIntentDeterministic } from "@/ai/parsing";
import { FulfillmentMode, Urgency } from "@prisma/client";
import type { UserContext } from "@/ai/types";

// Fixed "now": Monday 2026-06-15 10:00 local. Tests assert relative-time parsing
// against this anchor.
function ctx(overrides: Partial<UserContext> = {}): UserContext {
  return {
    now: new Date("2026-06-15T10:00:00+08:00"),
    timezone: "Asia/Kuala_Lumpur",
    ...overrides,
  };
}

describe("parseIntentDeterministic", () => {
  it("parses '2pm today free Thai massage 2 hours near me'", () => {
    const r = parseIntentDeterministic(
      "2pm today free Thai massage 2 hours near me",
      ctx(),
    );
    expect(r.serviceType).toBe("Thai massage");
    expect(r.durationMinutes).toBe(120);
    expect(r.locationText).toBe("near me");
    expect(r.fulfillmentMode).toBe(FulfillmentMode.UNKNOWN);
    expect(r.budgetMin).toBeNull();
    expect(r.requestedStartTime).not.toBeNull();
    const start = new Date(r.requestedStartTime!);
    expect(start.getHours()).toBe(14);
    expect(r.urgency).toBe(Urgency.SAME_DAY);
  });

  it("parses 'massage today afternoon near KLCC under 250'", () => {
    const r = parseIntentDeterministic(
      "massage today afternoon near KLCC under 250",
      ctx(),
    );
    // Generic "massage" with no style → serviceType ambiguous (null).
    expect(r.serviceType).toBeNull();
    expect(r.locationText).toBe("KLCC");
    expect(r.budgetMax).toBe(25000); // RM250 in sen
    const start = new Date(r.requestedStartTime!);
    expect(start.getHours()).toBe(14); // afternoon → 2pm
    expect(r.confidence.ambiguityNotes.length).toBeGreaterThan(0);
  });

  it("parses 'need relaxing massage after work Bangsar 90 mins'", () => {
    const r = parseIntentDeterministic(
      "need relaxing massage after work Bangsar 90 mins",
      ctx(),
    );
    expect(r.serviceType).toBe("Relaxing massage");
    expect(r.durationMinutes).toBe(90);
    expect(r.locationText).toBe("Bangsar");
    const start = new Date(r.requestedStartTime!);
    expect(start.getHours()).toBe(18); // after work → 6pm
  });

  it("parses 'tmr morning 2 hour deep tissue near me'", () => {
    const r = parseIntentDeterministic(
      "tmr morning 2 hour deep tissue near me",
      ctx(),
    );
    expect(r.serviceType).toBe("Deep tissue massage");
    expect(r.durationMinutes).toBe(120);
    const start = new Date(r.requestedStartTime!);
    expect(start.getDate()).toBe(16); // tomorrow
    expect(start.getHours()).toBe(9); // morning
  });

  it("parses 'spa massage tonight female therapist not too expensive'", () => {
    const r = parseIntentDeterministic(
      "spa massage tonight female therapist not too expensive",
      ctx(),
    );
    expect(r.serviceType).toBe("Aromatherapy massage"); // spa → aromatherapy
    expect(r.preferences.therapistGender).toBe("female");
    const start = new Date(r.requestedStartTime!);
    expect(start.getHours()).toBe(20); // tonight
    // "not too expensive" → no number, ambiguity note, no budget set.
    expect(r.budgetMax).toBeNull();
    expect(
      r.confidence.ambiguityNotes.some((n) => /budget|price/i.test(n)),
    ).toBe(true);
  });

  it("uses relationship history for 'same as last time but this Friday'", () => {
    const r = parseIntentDeterministic("same as last time but this Friday", {
      ...ctx(),
      relationship: {
        providerId: "p1",
        usualServiceType: "Relaxing massage",
        usualDurationMinutes: 90,
        usualBudgetMin: 12000,
        usualBudgetMax: 18000,
      },
    });
    expect(r.serviceType).toBe("Relaxing massage");
    expect(r.durationMinutes).toBe(90);
    expect(r.budgetMax).toBe(18000);
    const start = new Date(r.requestedStartTime!);
    // Friday after Monday 2026-06-15 is 2026-06-19.
    expect(start.getDay()).toBe(5);
  });

  it("applies non-conflicting passport defaults only", () => {
    const r = parseIntentDeterministic("thai massage 2pm today", {
      ...ctx(),
      passport: {
        preferredAreas: ["Bangsar"],
        preferredBudgetMin: 10000,
        preferredBudgetMax: 20000,
        preferredServiceStyles: [],
        avoidPreferences: [],
        preferredProviderGender: "female",
        defaultTravelRadiusKm: 12,
        preferredFulfillmentMode: "VISIT_PROVIDER",
      },
    });
    // No location in text → passport area applied.
    expect(r.locationText).toBe("Bangsar");
    // No budget in text → passport budget applied.
    expect(r.budgetMax).toBe(20000);
    // No fulfillment in text → passport mode applied.
    expect(r.fulfillmentMode).toBe(FulfillmentMode.VISIT_PROVIDER);
  });

  it("detects home service fulfillment from text", () => {
    const r = parseIntentDeterministic(
      "thai massage at home 7pm today 60 mins KLCC",
      ctx(),
    );
    expect(r.fulfillmentMode).toBe(FulfillmentMode.HOME_SERVICE);
  });
});
