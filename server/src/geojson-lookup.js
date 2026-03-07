/**
 * Server-side place lookup: first from server/data/municipalities.geojson,
 * then (caller) from Nominatim. Same name normalization as client for consistent matching.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const MUNICIPALITIES_PATH = path.join(DATA_DIR, "municipalities.geojson");

function normalize(s) {
  return String(s)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[׳״"']/g, "")
    .replace(/[‐-‒–—−]/g, "-")
    .replace(/\u200f|\u200e/g, "");
}

const REGION_SUFFIXES = [
  /,\s*יהודה ושומרון\s*$/i,
  /,\s*בקעת הירדן\s*$/i,
  /,\s*West Bank\s*$/i,
  /,\s*Jordan Valley\s*$/i,
  /,\s*Israel\s*$/i,
  /,\s*חבל אילות\s*$/i,
  /,\s*הערבה\s*$/i,
];

function stripRegionSuffix(s) {
  let t = String(s).trim();
  for (const re of REGION_SUFFIXES) {
    t = t.replace(re, "").trim();
  }
  return t;
}

const OREF_TO_BASE_OVERRIDES = {
  "תל אביב": "תל אביב-יפו",
  "תל אביב יפו": "תל אביב-יפו",
  "תל אביב-יפו": "תל אביב-יפו",
  "חבל מודיעין": "מודיעין",
  "חבל אילות": "אילת",
  "הערבה התיכונה": "ערבה",
  "עין קניא": "עין קנייא",
};

function toBaseMunicipalityName(raw) {
  let s = normalize(raw);
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

function cleanupParens(s) {
  return normalize(s)
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PREFIX_WORDS = new Set(["קריית", "קרית", "כפר", "מושב", "קיבוץ"]);

function stripPrefix(raw) {
  const s = normalize(raw);
  const parts = s.split(" ").filter(Boolean);
  if (parts.length >= 2 && PREFIX_WORDS.has(parts[0]))
    return parts.slice(1).join(" ");
  return s;
}

function buildLookupKeys(raw) {
  const out = new Set();
  const original = normalize(raw);
  const base = normalize(toBaseMunicipalityName(raw));
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
    .map(normalize)
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

function looksHebrew(s) {
  return /[\u0590-\u05FF]/.test(String(s));
}

function extractFeatureNames(props) {
  if (!props || typeof props !== "object") return [];
  const strings = [];
  for (const v of Object.values(props)) {
    if (typeof v === "string" && v.trim()) strings.push(v.trim());
  }
  const heb = strings.filter(looksHebrew);
  const ordered = heb.length ? heb : strings;
  return Array.from(new Set(ordered));
}

function outerRingLonLat(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Polygon" && geometry.coordinates?.[0]?.length) {
    return geometry.coordinates[0];
  }
  if (
    geometry.type === "MultiPolygon" &&
    geometry.coordinates?.[0]?.[0]?.length
  ) {
    return geometry.coordinates[0][0];
  }
  return null;
}

function bboxAndCenter(ring) {
  if (!ring.length) return null;
  let minLon = Infinity,
    maxLon = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  if (minLat === Infinity) return null;
  return {
    bbox: [minLat, maxLat, minLon, maxLon],
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2,
  };
}

/** Nominatim-style result: { lat, lon, boundingbox, display_name } */
function toNominatimLike(place, ring) {
  const bc = bboxAndCenter(ring);
  if (!bc) return null;
  return {
    lat: String(bc.lat),
    lon: String(bc.lon),
    boundingbox: [
      String(bc.bbox[0]),
      String(bc.bbox[1]),
      String(bc.bbox[2]),
      String(bc.bbox[3]),
    ],
    display_name: place,
  };
}

let index = null;
let indexPath = null;

function loadIndex(geojsonPath) {
  const p = geojsonPath || MUNICIPALITIES_PATH;
  if (index && indexPath === p) return index;
  indexPath = p;
  index = new Map();
  if (!fs.existsSync(p)) return index;
  let raw;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch {
    return index;
  }
  let fc;
  try {
    fc = JSON.parse(raw);
  } catch {
    return index;
  }
  const features = fc?.features;
  if (!Array.isArray(features)) return index;
  for (const f of features) {
    const names = extractFeatureNames(f.properties);
    const geom = f.geometry;
    for (const n of names) {
      for (const key of buildLookupKeys(n)) {
        const arr = index.get(key) || [];
        arr.push({ feature: f, geometry: geom });
        index.set(key, arr);
      }
    }
  }
  return index;
}

/** Convert Nominatim-like result to GeoBox shape for WS/client */
function toGeoBox(place, nominatimLike) {
  if (nominatimLike?.lat == null || nominatimLike?.lon == null) return null;
  const bbox = nominatimLike.boundingbox;
  if (!Array.isArray(bbox) || bbox.length < 4) return null;
  return {
    place: String(place),
    bbox: bbox.map(Number),
    center: {
      lat: Number(nominatimLike.lat),
      lon: Number(nominatimLike.lon),
    },
    displayName: nominatimLike.display_name,
    title: String(place),
  };
}

/**
 * Look up place in server GeoJSON. Returns one Nominatim-shaped result or null.
 */
function lookupFromGeoJson(place, geojsonPath) {
  const placeTrimmed = typeof place === "string" ? place.trim() : "";
  if (!placeTrimmed) return null;
  const idx = loadIndex(geojsonPath);
  if (idx.size === 0) return null;
  for (const key of buildLookupKeys(placeTrimmed)) {
    const arr = idx.get(key);
    if (arr?.length) {
      const { geometry } = arr[0];
      const ring = outerRingLonLat(geometry);
      if (ring?.length) {
        return toNominatimLike(placeTrimmed, ring);
      }
    }
  }
  return null;
}

/**
 * Look up place in GeoJSON and return GeoBox or null.
 */
function lookupGeoBox(place, geojsonPath) {
  const raw = lookupFromGeoJson(place, geojsonPath);
  return raw ? toGeoBox(place, raw) : null;
}

module.exports = {
  lookupFromGeoJson,
  lookupGeoBox,
  toGeoBox,
  loadIndex,
  MUNICIPALITIES_PATH,
};
