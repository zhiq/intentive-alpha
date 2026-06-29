import { describe, expect, it } from "vitest";
import {
  fromAppDateTimeLocalInput,
  toAppDateTimeLocalInput,
} from "@/lib/dateTime";
import { formDataToCompletionInput } from "@/app/actions/intentCompletionForm";
import { intentCompletionSchema } from "@/domain/schema/intent";
import { FulfillmentMode } from "@/domain/enums";
import {
  fulfillmentModeFormValue,
  fulfillmentModeOptions,
} from "@/components/intent/IntentCard.form";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("Intent Card form helpers", () => {
  it("round-trips app-local datetime values without shifting wall time", () => {
    const iso = fromAppDateTimeLocalInput("2026-06-15T14:00");
    expect(iso).toBe("2026-06-15T06:00:00.000Z");
    expect(toAppDateTimeLocalInput(iso)).toBe("2026-06-15T14:00");
  });

  it("uses nulls for cleared nullable fields", () => {
    const input = formDataToCompletionInput(
      form({
        serviceType: "",
        requestedStartTime: "",
        durationMinutes: "",
        locationText: "",
        budgetMinRm: "",
        therapistGender: "",
      }),
    );
    expect(input).toMatchObject({
      serviceType: null,
      requestedStartTime: null,
      durationMinutes: null,
      locationText: null,
      budgetMin: null,
      preferences: { therapistGender: null },
    });
  });

  it("parses optional-only submissions without requiring mandatory fields", () => {
    const input = formDataToCompletionInput(
      form({
        budgetMinRm: "120.50",
        pressureStyle: "medium",
      }),
    );

    expect(input).toMatchObject({
      budgetMin: 12050,
      preferences: { pressureStyle: "medium" },
    });
    expect(input).not.toHaveProperty("serviceType");
    expect(input).not.toHaveProperty("locationText");
  });

  it("omits empty fulfillment mode so the missing-field gate remains authoritative", () => {
    const input = formDataToCompletionInput(
      form({
        fulfillmentMode: "",
      }),
    );

    expect(input).not.toHaveProperty("fulfillmentMode");
  });

  it("maps UNKNOWN fulfillment mode to an empty form value", () => {
    expect(fulfillmentModeFormValue(FulfillmentMode.UNKNOWN)).toBe("");
    expect(fulfillmentModeFormValue(FulfillmentMode.HOME_SERVICE)).toBe(
      FulfillmentMode.HOME_SERVICE,
    );
    expect(fulfillmentModeOptions.map(([value]) => value)).not.toContain(
      FulfillmentMode.UNKNOWN,
    );
  });

  it("rejects inverted budget ranges", () => {
    const result = intentCompletionSchema.safeParse({
      budgetMin: 30000,
      budgetMax: 20000,
    });
    expect(result.success).toBe(false);
  });
});
