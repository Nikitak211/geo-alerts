/**
 * Normalize OREF settlement names for matching: Hebrew-safe trim, quote variants,
 * spacing, region suffixes, and known overrides. Use exact normalized form first.
 */

/** Quote and dash variants to strip or normalize */
const QUOTE_CHARS = /[׳״"''`]/g;
const DASH_VARIANTS = /[‐-‒–—−]/g;
const RTL_MARKS = /\u200f|\u200e/g;

const REGION_SUFFIXES = [
  /,\s*יהודה ושומרון\s*$/i,
  /,\s*בקעת הירדן\s*$/i,
  /,\s*West Bank\s*$/i,
  /,\s*Jordan Valley\s*$/i,
  /,\s*Israel\s*$/i,
  /,\s*חבל אילות\s*$/i,
  /,\s*הערבה\s*$/i,
];

const OREF_TO_BASE_OVERRIDES: Record<string, string> = {
  "תל אביב": "תל אביב-יפו",
  "תל אביב יפו": "תל אביב-יפו",
  "תל אביב-יפו": "תל אביב-יפו",
  "חבל מודיעין": "מודיעין",
  "חבל אילות": "אילת",
  "הערבה התיכונה": "ערבה",
  "עין קניא": "עין קנייא",
};

const PREFIX_WORDS = new Set([
  "קריית",
  "קרית",
  "כפר",
  "מושב",
  "קיבוץ",
]);

/**
 * Base normalization: trim, collapse spaces, remove quote variants, normalize dashes, strip RTL marks.
 */
export function normalizeSettlementName(name: string): string {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(QUOTE_CHARS, "")
    .replace(DASH_VARIANTS, "-")
    .replace(RTL_MARKS, "")
    .trim();
}

function stripRegionSuffix(s: string): string {
  let t = String(s).trim();
  for (const re of REGION_SUFFIXES) {
    t = t.replace(re, "").trim();
  }
  return t;
}

function toBaseMunicipalityName(raw: string): string {
  let s = normalizeSettlementName(raw);
  s = stripRegionSuffix(s);
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

function cleanupParens(s: string): string {
  return normalizeSettlementName(s)
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPrefix(s: string): string {
  const parts = normalizeSettlementName(s).split(" ").filter(Boolean);
  if (parts.length >= 2 && PREFIX_WORDS.has(parts[0])) {
    return parts.slice(1).join(" ");
  }
  return s;
}

/**
 * Return lookup keys in priority order for exact normalized matching.
 * First key that exists in the index should win (exact match first).
 */
export function getLookupCandidates(raw: string): string[] {
  const rawTrimmed = String(raw).trim();
  const original = normalizeSettlementName(raw);
  const base = normalizeSettlementName(toBaseMunicipalityName(raw));
  const candidates = [
    ...(rawTrimmed ? [rawTrimmed] : []),
    original,
    base,
    cleanupParens(original),
    cleanupParens(base),
    stripPrefix(original),
    stripPrefix(base),
    stripPrefix(cleanupParens(original)),
    stripPrefix(cleanupParens(base)),
  ]
    .map((x) => (x === rawTrimmed ? x : normalizeSettlementName(x)))
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of candidates) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    const withSpace = s.replace(/-/g, " ");
    const withDash = s.replace(/\s+/g, "-");
    const normalizedDash = s.replace(/\s*-\s*/g, "-");
    const normalizedSpace = s.replace(/\s*-\s*/g, " - ");
    for (const v of [withSpace, withDash, normalizedDash, normalizedSpace]) {
      const n = normalizeSettlementName(v);
      if (n && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
  }
  return out;
}
