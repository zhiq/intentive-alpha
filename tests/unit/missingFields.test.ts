import { describe, it, expect } from "vitest";
import { detectMissingFieldsRule } from "@/ai/missingFields";
import type { IntentProjection } from "@/ai/types";
import { FulfillmentMode } from "@prisma/client";

function projection(overrides: Partial<IntentProjection> = {}): IntentProjection {
  return {
    rawInput: "x",
    category: "massage_wellness",
    serviceType: "Thai massage",
    requestedStartTime: new Date().toISOString(),
    requestedEndTime: null,
    durationMinutes: 120,
    locationText: "KLCC",
    fulfillmentMode: FulfillmentMode.VISIT_PROVIDER,
    budgetMin: null,
    budgetMax: null,
    preferences: {},
    ...overrides,
  };
}

describe("detectMissingFieldsRule", () => {
  it("returns no missing fields when all mandatory blockers present", () => {
    const r = detectMissingFieldsRule(projection());
    expect(r.missing).toEqual([]);
  });

  it("flags every missing mandatory blocker", () => {
    const r = detectMissingFieldsRule(
      projection({
        serviceType: null,
        requestedStartTime: null,
        durationMinutes: null,
        locationText: null,
        fulfillmentMode: FulfillmentMode.UNKNOWN,
      }),
    );
    expect(r.missing).toEqual([
      "serviceType",
      "requestedStartTime",
      "durationMinutes",
      "location",
      "fulfillmentMode",
    ]);
  });

  it("treats UNKNOWN fulfillment as missing", () => {
    const r = detectMissingFieldsRule(
      projection({ fulfillmentMode: FulfillmentMode.UNKNOWN }),
    );
    expect(r.missing).toContain("fulfillmentMode");
  });

  it("suggests budget as optional when absent (never blocks)", () => {
    const r = detectMissingFieldsRule(projection({ budgetMax: null }));
    expect(r.missing).toEqual([]);
    expect(r.optionalSuggestions).toContain("budget");
  });

  it("preserves canonical field order", () => {
    const r = detectMissingFieldsRule(
      projection({ durationMinutes: null, serviceType: null }),
    );
    expect(r.missing).toEqual(["serviceType", "durationMinutes"]);
  });
});
