import { fromAppDateTimeLocalInput } from "@/lib/dateTime";

export function formDataToCompletionInput(
  formData: FormData,
): Record<string, unknown> {
  const input: Record<string, unknown> = {};

  setNullableString(input, formData, "serviceType");
  setNullableDateTime(input, formData, "requestedStartTime");
  setNullableNumber(input, formData, "durationMinutes");
  setNullableString(input, formData, "locationText");
  setNullableNumber(input, formData, "latitude");
  setNullableNumber(input, formData, "longitude");
  setString(input, formData, "fulfillmentMode");
  setNullableRinggit(input, formData, "budgetMinRm", "budgetMin");
  setNullableRinggit(input, formData, "budgetMaxRm", "budgetMax");
  setNullableNumber(input, formData, "travelRadiusKm");
  setNullableNumber(input, formData, "flexibilityTimeMinutes");

  const preferences: Record<string, unknown> = {};
  setNullableString(preferences, formData, "therapistGender");
  setNullableString(preferences, formData, "pressureStyle");
  if (Object.keys(preferences).length) input.preferences = preferences;

  return input;
}

function stringValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  return value.trim();
}

function setString(
  target: Record<string, unknown>,
  formData: FormData,
  key: string,
) {
  const value = stringValue(formData, key);
  if (value) target[key] = value;
}

function setNullableString(
  target: Record<string, unknown>,
  formData: FormData,
  key: string,
) {
  const value = stringValue(formData, key);
  if (value === undefined) return;
  target[key] = value.length ? value : null;
}

function setNullableDateTime(
  target: Record<string, unknown>,
  formData: FormData,
  key: string,
) {
  const value = stringValue(formData, key);
  if (value === undefined) return;
  target[key] = value.length ? fromAppDateTimeLocalInput(value) : null;
}

function setNullableNumber(
  target: Record<string, unknown>,
  formData: FormData,
  key: string,
) {
  const value = stringValue(formData, key);
  if (value === undefined) return;
  if (!value.length) {
    target[key] = null;
    return;
  }
  const number = Number(value);
  if (Number.isFinite(number)) target[key] = number;
}

function setNullableRinggit(
  target: Record<string, unknown>,
  formData: FormData,
  key: string,
  targetKey: string,
) {
  const value = stringValue(formData, key);
  if (value === undefined) return;
  if (!value.length) {
    target[targetKey] = null;
    return;
  }
  const number = Number(value);
  if (Number.isFinite(number)) target[targetKey] = Math.round(number * 100);
}
