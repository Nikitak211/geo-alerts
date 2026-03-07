/**
 * Normalize area name for matching: trim and collapse spaces.
 * Kept inside ingest so raw handling stays in one place.
 */
export function normalizeAreaName(name: unknown): string {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ");
}
