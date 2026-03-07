/** Normalize Hebrew/English place name for matching. */
export const normalize = (s: string): string =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[׳״"']/g, "")
    .replace(/[‐-‒–—−]/g, "-")
    .replace(/\u200f|\u200e/g, "");

export const PREFIX_WORDS = new Set(["קריית", "קרית", "כפר", "מושב", "קיבוץ"]);

export function stripPrefix(raw: string): string {
  const s = normalize(raw);
  const parts = s.split(" ").filter(Boolean);
  if (parts.length >= 2 && PREFIX_WORDS.has(parts[0]))
    return parts.slice(1).join(" ");
  return s;
}

export const OREF_TO_BASE_OVERRIDES: Record<string, string> = {
  "תל אביב": "תל אביב-יפו",
  "תל אביב יפו": "תל אביב-יפו",
  "תל אביב-יפו": "תל אביב-יפו",
};

export function toBaseMunicipalityName(raw: string): string {
  let s = normalize(raw);
  const dash = s.split(" - ");
  if (dash.length > 1) s = dash[0].trim();
  s = s
    .replace(/^אזור תעשייה\s+/, "")
    .replace(/^פארק\s+/, "")
    .replace(/^תחנת רכבת\s+/, "")
    .replace(/^בית עלמין\s+/, "")
    .replace(/^מרכז אזורי\s+/, "")
    .replace(/^מסוף\s+/, "")
    .trim();
  if (OREF_TO_BASE_OVERRIDES[s]) s = OREF_TO_BASE_OVERRIDES[s];
  return s;
}

export function cleanupParens(s: string): string {
  return normalize(s)
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function unifyHebrewPunctuation(s: string): string {
  return normalize(s)
    .replace(/׳/g, "")
    .replace(/"/g, "")
    .replace(/״/g, "")
    .replace(/'/g, "");
}

export function buildLookupKeys(raw: string): string[] {
  const out = new Set<string>();
  const rawTrimmed = String(raw).trim();
  if (rawTrimmed) out.add(rawTrimmed);

  const original = unifyHebrewPunctuation(raw);
  const base = unifyHebrewPunctuation(toBaseMunicipalityName(raw));
  const candidates = [
    original,
    base,
    cleanupParens(original),
    cleanupParens(base),
    stripPrefix(original),
    stripPrefix(base),
    stripPrefix(cleanupParens(original)),
    stripPrefix(cleanupParens(base)),
  ]
    .map((x) => normalize(x))
    .filter(Boolean);
  for (const s of candidates) {
    out.add(s);
    out.add(s.replace(/-/g, " "));
    out.add(s.replace(/\s+/g, "-"));
    out.add(s.replace(/\s*-\s*/g, "-"));
    out.add(s.replace(/\s*-\s*/g, " - "));
  }
  return Array.from(out).map(normalize).filter(Boolean);
}

/** Normalize English place names (cities name_en vs GeoJSON SHEM_YISHUV_ENGLISH). */
export function normalizeEnglish(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[''׳`]/g, "");
}
