import * as Cesium from "cesium";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoBox, OrefAlert } from "../types";

/* -------------------- GeoJSON types -------------------- */
type FeatureCollection = {
  type: "FeatureCollection";
  features: Feature[];
};

type Feature = {
  type: "Feature";
  properties?: Record<string, any>;
  geometry?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any;
  };
};

/* =========================
   NAME NORMALIZATION + LOOKUP KEYS (NO FUZZY / NO CONTAINS)
   ========================= */

const normalize = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[׳״"']/g, "")
    .replace(/[‐-‒–—−]/g, "-")
    .replace(/\u200f|\u200e/g, ""); // RTL marks

const looksHebrew = (s: string) => /[\u0590-\u05FF]/.test(s);

const PREFIX_WORDS = new Set(["קריית", "קרית", "כפר", "מושב", "קיבוץ"]);

function stripPrefix(raw: string): string {
  const s = normalize(raw);
  const parts = s.split(" ").filter(Boolean);
  if (parts.length >= 2 && PREFIX_WORDS.has(parts[0]))
    return parts.slice(1).join(" ");
  return s;
}

const OREF_TO_BASE_OVERRIDES: Record<string, string> = {
  "תל אביב": "תל אביב-יפו",
  "תל אביב יפו": "תל אביב-יפו",
  "תל אביב-יפו": "תל אביב-יפו",
  "חבל מודיעין": "מודיעין",
  "חבל אילות": "אילת",
  "הערבה התיכונה": "ערבה",
  "עין קניא": "עין קנייא",
};

// Region suffixes OREF appends after comma; strip so "שאר ישוב, יהודה ושומרון" -> "שאר ישוב"
const REGION_SUFFIXES = [
  /,\s*יהודה ושומרון\s*$/i,
  /,\s*בקעת הירדן\s*$/i,
  /,\s*West Bank\s*$/i,
  /,\s*Jordan Valley\s*$/i,
  /,\s*Israel\s*$/i,
  /,\s*חבל אילות\s*$/i,
  /,\s*הערבה\s*$/i,
];

function stripRegionSuffix(s: string): string {
  let t = s.trim();
  for (const re of REGION_SUFFIXES) {
    t = t.replace(re, "").trim();
  }
  return t;
}

function toBaseMunicipalityName(raw: string) {
  let s = normalize(raw);

  // OREF often sends "Place, Region" — strip region so we match GeoJSON MUN_HEB (e.g. "שאר ישוב")
  s = stripRegionSuffix(s);

  // OREF uses "X - Y" for sub-areas; keep left side
  const dash = s.split(" - ");
  if (dash.length > 1) s = dash[0].trim();

  // remove non-municipality prefixes that appear in OREF
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

function cleanupParens(s: string) {
  return normalize(s)
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLookupKeys(raw: string): string[] {
  const out = new Set<string>();

  const rawTrimmed = String(raw).trim();
  if (rawTrimmed) out.add(rawTrimmed);

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

    // hyphen <-> space
    out.add(s.replace(/-/g, " "));
    out.add(s.replace(/\s+/g, "-"));

    // normalize "X - Y" into "X-Y" and vice versa
    out.add(s.replace(/\s*-\s*/g, "-"));
    out.add(s.replace(/\s*-\s*/g, " - "));
  }

  return Array.from(out).map(normalize).filter(Boolean);
}

/* -------------------- feature-name extraction (generic) -------------------- */
function extractFeatureNames(props?: Record<string, any>): string[] {
  if (!props) return [];

  const strings: string[] = [];
  for (const v of Object.values(props)) {
    if (typeof v === "string" && v.trim()) strings.push(v.trim());
  }

  const heb = strings.filter(looksHebrew);
  const ordered = heb.length ? heb : strings;

  return Array.from(new Set(ordered));
}

/* -------------------- polygon bbox helpers -------------------- */
function outerRingLonLat(f: Feature): [number, number][] | null {
  const g = f.geometry;
  if (!g) return null;

  if (g.type === "Polygon") {
    const rings = g.coordinates as [number, number][][];
    return rings?.[0]?.length ? (rings[0] as [number, number][]) : null;
  }

  if (g.type === "MultiPolygon") {
    const polys = g.coordinates as [number, number][][][];
    const firstPoly = polys?.[0];
    const outer = firstPoly?.[0];
    return outer?.length ? (outer as [number, number][]) : null;
  }

  return null;
}

function bboxFromRing(ring: [number, number][]) {
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

  const bbox: [number, number, number, number] = [
    minLat,
    maxLat,
    minLon,
    maxLon,
  ];
  const center = { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };

  return { bbox, center };
}

/** Center of polygon from ring using Cesium's Rectangle (2D bounds on globe). */
function centerFromRingCesium(ring: [number, number][]): { lat: number; lon: number } | null {
  if (ring.length === 0) return null;
  try {
    const cartographics = ring.map(([lon, lat]) =>
      Cesium.Cartographic.fromDegrees(lon, lat)
    );
    const rectangle = Cesium.Rectangle.fromCartographicArray(cartographics);
    const center = Cesium.Rectangle.center(rectangle, new Cesium.Cartographic());
    return {
      lat: Cesium.Math.toDegrees(center.latitude),
      lon: Cesium.Math.toDegrees(center.longitude),
    };
  } catch {
    return null;
  }
}

/* =========================
   GeoJSON loader + lookup index (cached)
   - geoIndex: lookupKey -> Feature[]
   ========================= */

/** Same as AlertTester: client public folder for fast same-origin load (no server fetch). */
function getMunicipalitiesUrl(): string {
  return "/data/municipalities.geojson";
}

let geoLoaded = false;
let geoLoading: Promise<void> | null = null;
let geoIndex: Map<string, Feature[]> = new Map();

async function ensureMunicipalitiesLoaded(signal?: AbortSignal) {
  if (geoLoaded) return;
  if (geoLoading) return geoLoading;

  geoLoading = (async () => {
    const url = getMunicipalitiesUrl();
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal,
        mode: "cors",
      });
    } catch (e) {
      geoIndex = new Map();
      geoLoaded = true;
      return;
    }

    if (!res.ok) {
      geoIndex = new Map();
      geoLoaded = true;
      return;
    }

    let fc: FeatureCollection;
    try {
      const text = await res.text();
      if (!text?.trim()) {
        fc = { type: "FeatureCollection", features: [] };
      } else {
        fc = JSON.parse(text) as FeatureCollection;
        if (!fc?.features) fc = { type: "FeatureCollection", features: [] };
      }
    } catch {
      fc = { type: "FeatureCollection", features: [] };
    }

    if (!Array.isArray(fc.features) || fc.features.length === 0) {
      if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
        console.warn(
          "[useOrefGeoBoxes] GeoJSON has no features. Place pins will use API fallback. Put municipalities.geojson in client public/data/ (e.g. properties.MUN_HEB) for place matching."
        );
      }
    }

    const idx = new Map<string, Feature[]>();

    for (const f of fc.features ?? []) {
      const names = extractFeatureNames(f.properties);

      for (const n of names) {
        for (const key of buildLookupKeys(n)) {
          const arr = idx.get(key) ?? [];
          arr.push(f);
          idx.set(key, arr);
        }
      }
    }

    geoIndex = idx;
    geoLoaded = true;
  })().finally(() => {
    geoLoading = null;
  });

  return geoLoading;
}

/* =========================
   cities.json loader (pin positions: lat, lng by Hebrew name)
   - Shape: array of { id?, name, name_en?, value?, lat, lng, zone?, ... }
   ========================= */

type CityRow = {
  name?: string;
  name_en?: string;
  value?: string;
  lat: number;
  lng: number;
};

let citiesLoaded = false;
let citiesLoading: Promise<void> | null = null;
const citiesIndex = new Map<string, { lat: number; lng: number }>();

const CITIES_URL = "/data/cities.json";

function bboxAroundPoint(lat: number, lon: number, deltaDeg = 0.005): [number, number, number, number] {
  return [lat - deltaDeg, lat + deltaDeg, lon - deltaDeg, lon + deltaDeg];
}

async function ensureCitiesLoaded(signal?: AbortSignal): Promise<void> {
  if (citiesLoaded) return;
  if (citiesLoading) return citiesLoading;

  citiesLoading = (async () => {
    try {
      const res = await fetch(CITIES_URL, { signal, headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const idx = new Map<string, { lat: number; lng: number }>();
      for (const row of list as CityRow[]) {
        const lat = Number(row?.lat);
        const lng = Number(row?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const name = typeof row?.name === "string" ? row.name.trim() : "";
        const value =
          typeof row?.value === "string" ? row.value.trim() : name;
        const nameEn =
          typeof row?.name_en === "string" ? row.name_en.trim() : "";
        if (!name || value === "all") continue;
        const names = [name, value, nameEn].filter(Boolean);
        const parts = name.split(",").map((s) => s.trim()).filter(Boolean);
        for (const n of [...names, ...parts]) {
          if (!n) continue;
          for (const key of buildLookupKeys(n)) {
            idx.set(key, { lat, lng });
          }
        }
      }
      idx.forEach((v, k) => citiesIndex.set(k, v));
      citiesLoaded = true;
    } catch {
      // ignore (missing or large file)
    } finally {
      citiesLoading = null;
    }
  })();

  return citiesLoading;
}

function pickBestResult(place: string, results: any[]): any | null {
  if (!results?.length) return null;

  const targetKeys = new Set(buildLookupKeys(place));

  const scored = results.map((r) => {
    const text = normalize(
      [
        r.name,
        r.display_name,
        r.address?.city,
        r.address?.town,
        r.address?.village,
        r.address?.hamlet,
        r.address?.municipality,
        r.address?.state_district,
        r.address?.state,
      ]
        .filter(Boolean)
        .join(" | "),
    );

    let score = 0;

    // Prefer longer key matches so "אזור תעשייה נשר - רמלה" beats "נשר" (avoids Haifa vs Ramla mix-up)
    for (const key of targetKeys) {
      if (text.includes(key)) score += 5 + key.length;
    }

    if (/בקעת הירדן|יהודה ושומרון|west bank|jordan valley/i.test(text)) {
      score += 20;
    }

    if (/israel/i.test(text)) {
      score += 2;
    }

    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].r : null;
}

/* =========================
   FALLBACK WEB API (Nominatim via server proxy to avoid CORS)
   ========================= */

function getGeocodeBase() {
  if (typeof window === "undefined") return "http://localhost:8090";
  const u = window.location;
  return u.port === "4421" ? "http://localhost:8090" : `${u.protocol}//${u.host}`;
}

async function geocodeFallbackIL(
  place: string,
  signal?: AbortSignal,
): Promise<GeoBox | null> {
  const base = getGeocodeBase();
  // Server does GeoJSON first then API; send only place name (e.g. "שדה נחמיה"), no ", Israel"
  const placeName = toBaseMunicipalityName(place);
  const candidates = placeName ? [placeName] : [place].filter(Boolean);

  for (const q of candidates) {
    const url = `${base}/api/geocode?place=${encodeURIComponent(q)}`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal,
    });

    if (!res.ok) continue;

    let results: any[];
    try {
      const data = await res.json();
      results = Array.isArray(data) ? data : [];
    } catch {
      continue;
    }
    const best = pickBestResult(place, results);
    if (!best) continue;

    const bb = best.boundingbox;
    if (!bb || bb.length < 4) continue;

    return {
      place,
      bbox: [Number(bb[0]), Number(bb[1]), Number(bb[2]), Number(bb[3])],
      center: { lat: Number(best.lat), lon: Number(best.lon) },
      displayName: best.display_name ?? place,
      title: place,
    };
  }

  return null;
}

/* =========================
   FALLBACK: Overpass API (OSM boundary relations in Israel)
   Use when GeoJSON + Nominatim don't find the place.
   ========================= */

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
// Israel (south, west, north, east) for Overpass bbox
const IL_BBOX = [29.45, 34.22, 33.35, 35.88];

function escapeOverpassRegex(s: string): string {
  return s.replace(/([.*+?^${}()|[\]\\])/g, "\\$1").trim();
}

async function geocodeOverpassIL(
  place: string,
  signal?: AbortSignal,
): Promise<GeoBox | null> {
  const escaped = escapeOverpassRegex(place);
  if (!escaped) return null;

  // Query: administrative boundaries in Israel with name or name:he matching
  const q = `[out:json][timeout:15];
(
  relation["boundary"="administrative"](${IL_BBOX.join(",")})["name"~"${escaped}",i];
  relation["boundary"="administrative"](${IL_BBOX.join(",")})["name:he"~"${escaped}"];
);
out geom;`;

  const res = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(q)}`,
    signal,
  });

  if (!res.ok) return null;

  const json = await res.json();
  const elements = json?.elements ?? [];
  const withGeom = elements.filter(
    (e: any) => e.geometry && Array.isArray(e.geometry) && e.geometry.length > 0,
  );
  if (withGeom.length === 0) return null;

  const first = withGeom[0];
  const geom = first.geometry as { lat: number; lon: number }[];
  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity;
  for (const p of geom) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  if (minLat === Infinity) return null;

  const bbox: [number, number, number, number] = [
    minLat,
    maxLat,
    minLon,
    maxLon,
  ];
  const center = { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
  const displayName =
    first.tags?.name ?? first.tags?.["name:he"] ?? place;

  return {
    place,
    bbox,
    center,
    displayName,
    title: place,
  };
}

/* =========================
   Per-pin resolver: shared cache + throttled API
   So the layer can render fast and each pin resolves on its own.
   ========================= */

const placeGeoCache = new Map<string, GeoBox>();
const API_CONCURRENCY = 4;
let apiInFlight = 0;
const apiQueue: Array<{
  place: string;
  resolve: (g: GeoBox | null) => void;
  reject: (e: any) => void;
  signal?: AbortSignal;
  fallbackToWebApi: boolean;
}> = [];

function drainApiQueue() {
  while (apiInFlight < API_CONCURRENCY && apiQueue.length > 0) {
    const job = apiQueue.shift()!;
    apiInFlight++;
    (async () => {
      try {
        let geo: GeoBox | null = await geocodeFallbackIL(
          job.place,
          job.signal,
        );
        if (!geo) {
          geo = await geocodeOverpassIL(job.place, job.signal);
        }
        if (geo) placeGeoCache.set(job.place, geo);
        job.resolve(geo);
      } catch (e: any) {
        if (e?.name === "AbortError") job.reject(e);
        else job.resolve(null);
      } finally {
        apiInFlight--;
        drainApiQueue();
      }
    })();
  }
}

/**
 * Resolve one place: cache → GeoJSON → API (throttled).
 * Shared by all pins so the layer stays fast and icons appear as they resolve.
 */
export async function getPlaceGeo(
  place: string,
  options: { signal?: AbortSignal; fallbackToWebApi?: boolean } = {},
): Promise<GeoBox | null> {
  const { signal, fallbackToWebApi = true } = options;
  if (placeGeoCache.has(place)) return placeGeoCache.get(place)!;

  await ensureCitiesLoaded(signal);
  const placeTrimmed = place.trim();
  // Prefer longer keys first; reject short-key matches so we don't show e.g. נשר for "אזור תעשייה נשר - רמלה"
  const keysBySpecificity = buildLookupKeys(place).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of keysBySpecificity) {
    if (placeTrimmed.length > 0 && key.length < placeTrimmed.length * 0.5) continue;
    const pos = citiesIndex.get(key);
    if (pos) {
      const center = { lat: pos.lat, lon: pos.lng };
      const geo: GeoBox = {
        place,
        bbox: bboxAroundPoint(center.lat, center.lon),
        center,
        displayName: place,
        title: place,
      };
      placeGeoCache.set(place, geo);
      return geo;
    }
  }

  await ensureMunicipalitiesLoaded(signal);
  if (geoLoaded) {
    const matched = new Set<Feature>();
    const geoKeysBySpecificity = buildLookupKeys(place).sort(
      (a, b) => b.length - a.length,
    );
    for (const key of geoKeysBySpecificity) {
      if (placeTrimmed.length > 0 && key.length < placeTrimmed.length * 0.5) continue;
      const fs = geoIndex.get(key);
      if (fs?.length) fs.forEach((f) => matched.add(f));
    }
    if (matched.size > 0) {
      const f = matched.values().next().value as Feature;
      const ring = outerRingLonLat(f);
      if (ring?.length) {
        const { bbox, center: bboxCenter } = bboxFromRing(ring);
        const center = centerFromRingCesium(ring) ?? bboxCenter;
        const geo: GeoBox = {
          place,
          bbox,
          center,
          displayName: place,
          title: place,
        };
        placeGeoCache.set(place, geo);
        return geo;
      }
    }
  }

  if (!fallbackToWebApi) return null;

  return new Promise<GeoBox | null>((resolve, reject) => {
    apiQueue.push({
      place,
      resolve,
      reject,
      signal,
      fallbackToWebApi,
    });
    drainApiQueue();
  });
}

/**
 * Hook for one pin: use serverPositions from WS when available, else resolve in background.
 */
export function usePlaceGeo(
  place: string,
  options: { fallbackToWebApi?: boolean; serverPositions?: Record<string, GeoBox> } = {},
) {
  const fromServer = options?.serverPositions?.[place];
  const [geo, setGeo] = useState<GeoBox | null>(fromServer ?? null);
  const [loading, setLoading] = useState(!fromServer);
  const { fallbackToWebApi = true } = options;

  useEffect(() => {
    if (options?.serverPositions?.[place]) {
      setGeo(options.serverPositions[place]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const ac = new AbortController();
    getPlaceGeo(place, { signal: ac.signal, fallbackToWebApi })
      .then((g) => {
        if (!cancelled) {
          setGeo(g);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [place, fallbackToWebApi, options?.serverPositions]);

  return {
    center: geo?.center ?? null,
    geo,
    loading,
  };
}

/* -------------------- hook types -------------------- */
type UseOrefGeoBoxesOptions = {
  resetOnNewAlert?: boolean;
  /** TTL in ms for each pin; same place again resets timer. Default 10 min. */
  pinTtlMs?: number;
};

const DEFAULT_PIN_TTL_MS = 10 * 60 * 1000; // 10 min

/* -------------------- hook -------------------- */
export function useOrefGeoBoxes(
  wsUrl: string,
  options: UseOrefGeoBoxesOptions = {},
) {
  const { resetOnNewAlert = false, pinTtlMs = DEFAULT_PIN_TTL_MS } = options;

  const [latestAlert, setLatestAlert] = useState<OrefAlert | null>(null);
  const [serverPositions, setServerPositions] = useState<Record<string, GeoBox>>({});
  const lastAlertIdRef = useRef<string | null>(null);

  /** Stored places with expiry; same place in a new alert resets its timer. Pins removed after TTL. */
  const [placesWithExpiry, setPlacesWithExpiry] = useState<
    Record<string, { title: string; expiresAt: number }>
  >({});

  /* -------------------- WebSocket -------------------- */
  useEffect(() => {
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);

        if (msg?.type === "oref_update" && msg?.payload) {
          const alert = msg.payload as OrefAlert;

          if (
            resetOnNewAlert &&
            alert?.id &&
            lastAlertIdRef.current !== alert.id
          ) {
            placeGeoCache.clear();
          }

          lastAlertIdRef.current = alert?.id ?? lastAlertIdRef.current;
          setLatestAlert(alert);

          if (alert?.data?.length) {
            const now = Date.now();
            const expiresAt = now + pinTtlMs;
            setPlacesWithExpiry((prev) => {
              const next = { ...prev };
              for (const place of alert.data) {
                next[place] = { title: alert.title, expiresAt };
              }
              return next;
            });
          }
        }

        if (msg?.type === "place_positions" && msg?.payload && typeof msg.payload === "object") {
          const boxes = msg.payload as Record<string, GeoBox>;
          for (const [p, g] of Object.entries(boxes)) {
            if (g?.center) placeGeoCache.set(p, g);
          }
          setServerPositions(boxes);
        }
      } catch {
        // ignore
      }
    };

    return () => ws.close();
  }, [wsUrl, resetOnNewAlert, pinTtlMs]);

  /* -------------------- Remove expired pins every 30s -------------------- */
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPlacesWithExpiry((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [place, v] of Object.entries(next)) {
          if (v.expiresAt <= now) {
            delete next[place];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const alertPlaces = useMemo(
    () =>
      Object.entries(placesWithExpiry).map(([place, v]) => ({
        place,
        title: v.title,
      })),
    [placesWithExpiry],
  );

  const clearAll = () => {
    setLatestAlert(null);
    setPlacesWithExpiry({});
    setServerPositions({});
    placeGeoCache.clear();
  };

  return {
    latestAlert,
    alertPlaces,
    clearAll,
    serverPositions,
  };
}
