// Product-local time helpers. The alpha market operates in Kuala Lumpur time;
// HTML datetime-local inputs are timezone-less, so every conversion must be
// explicit to avoid silently shifting appointment times.
export const APP_TIME_ZONE = "Asia/Kuala_Lumpur";
const APP_TIME_ZONE_OFFSET_MINUTES = 8 * 60;

export function toAppDateTimeLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const appTime = new Date(
    date.getTime() + APP_TIME_ZONE_OFFSET_MINUTES * 60_000,
  );
  return appTime.toISOString().slice(0, 16);
}

export function fromAppDateTimeLocalInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const instant = new Date(utcMs - APP_TIME_ZONE_OFFSET_MINUTES * 60_000);
  return Number.isFinite(instant.getTime()) ? instant.toISOString() : null;
}
