/**
 * Areas that are regions/districts (e.g. "גולן") rather than cities or settlements.
 */

const normalize = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[׳״"']/g, "")
    .replace(/[‐-‒–—−]/g, "-")
    .replace(/\u200f|\u200e/g, "");

/** Known region names (normalized). Regional councils / districts, not cities. */
const REGION_NAMES = new Set(
  [
    "גולן",
    "הגולן",
    "גליל",
    "הגליל",
    "גליל עליון",
    "גליל תחתון",
    "יהודה ושומרון",
    "יהודה והשומרון",
    "השומרון",
    "שומרון",
    "בקעת הירדן",
    "הנגב",
    "נגב",
    "עוטף ירושלים",
    "אשכול",
    "מטה אשר",
    "הגלבוע",
    "גלבוע",
    "עמק המעיינות",
    "עמק חפר",
    "מנשה",
    "עמק יזרעאל",
    "עמק הירדן",
    "מגידו",
    "חוף הכרמל",
    "זבולון",
    "מטה יהודה",
    "מטה בנימין",
    "לכיש",
    "תמר",
    "חוף אשקלון",
    "שפיר",
    "באר טוביה",
    "הערבה התיכונה",
    "חבל אילות",
    "חבל מודיעין",
  ].map(normalize),
);

/** Cities/settlements that must never be treated as regions (e.g. substring of "עוטף ירושלים" or "חוף אשקלון"). */
const NOT_REGION_NAMES = new Set(
  ["ירושלים", "תל אביב", "תל אביב-יפו", "חיפה", "באר שבע", "אשדוד", "נתניה", "רמת גן", "חולון", "בת ים", "אשקלון"].map(
    normalize,
  ),
);

/**
 * Returns true if areaHeb is a region/district (not a city or settlement).
 * Matches exact normalized name or if the area name contains a known region name.
 */
export function isRegion(areaHeb: string): boolean {
  if (!areaHeb || typeof areaHeb !== "string") return false;
  const n = normalize(areaHeb);
  if (NOT_REGION_NAMES.has(n)) return false;
  if (REGION_NAMES.has(n)) return true;
  for (const r of REGION_NAMES) {
    if (n.includes(r) || r.includes(n)) return true;
  }
  return false;
}

/** Areas that are hidden on the map (e.g. "ללא שיפוט"). */
const HIDDEN_ON_MAP = new Set(["ללא שיפוט"].map(normalize));

/**
 * Returns true if areaHeb is hidden on the map.
 */
export function isHiddenOnMap(areaHeb: string): boolean {
  if (!areaHeb || typeof areaHeb !== "string") return false;
  return HIDDEN_ON_MAP.has(normalize(areaHeb));
}
