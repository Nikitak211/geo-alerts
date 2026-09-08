/**
 * Israel timezone helpers. Always uses Asia/Jerusalem regardless of server TZ.
 */

/**
 * Returns the minute-of-day (0–1439) for a Date in Asia/Jerusalem timezone.
 * Replaces date.getHours()*60 + date.getMinutes() which uses local server TZ.
 */
export function getMinuteOfDayInJerusalem(date: Date): number {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jerusalem",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const hourPart = parts.find((p) => p.type === "hour");
  const minutePart = parts.find((p) => p.type === "minute");

  const h = parseInt(hourPart?.value ?? "0", 10);
  const m = parseInt(minutePart?.value ?? "0", 10);

  // Intl may return 24 for midnight in some environments
  const normalH = h === 24 ? 0 : h;
  return normalH * 60 + m;
}
