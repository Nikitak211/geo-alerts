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
};

function toBaseMunicipalityName(raw: string) {
  let s = normalize(raw);

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

/* =========================
   GeoJSON loader + lookup index (cached)
   - geoIndex: lookupKey -> Feature[]
   ========================= */

const MUNICIPALITIES_URL = "/data/municipalities.geojson";

let geoLoaded = false;
let geoLoading: Promise<void> | null = null;
let geoIndex: Map<string, Feature[]> = new Map();

async function ensureMunicipalitiesLoaded(signal?: AbortSignal) {
  if (geoLoaded) return;
  if (geoLoading) return geoLoading;

  geoLoading = (async () => {
    const res = await fetch(MUNICIPALITIES_URL, {
      headers: { Accept: "application/json" },
      signal,
    });

    if (!res.ok) {
      throw new Error(
        `Failed to load ${MUNICIPALITIES_URL} (HTTP ${res.status})`,
      );
    }

    const fc = (await res.json()) as FeatureCollection;

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

    for (const key of targetKeys) {
      if (text.includes(key)) score += 10;
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
   FALLBACK WEB API (Nominatim)
   ========================= */

// If you prefer to proxy this via your own server (recommended for rate-limit / CORS control),
// change this to your server endpoint (e.g. "/api/geocode?place=...")
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

async function geocodeFallbackIL(
  place: string,
  signal?: AbortSignal,
): Promise<GeoBox | null> {
  const candidates = [
    `${place}`,
    `${place}, בקעת הירדן`,
    `${place}, יהודה ושומרון`,
    `${place}, West Bank`,
    `${place}, Jordan Valley`,
    `${place}, Israel`,
  ];

  for (const q of candidates) {
    const url =
      `${NOMINATIM}?q=${encodeURIComponent(q)}` +
      `&format=jsonv2&limit=5&addressdetails=1&accept-language=he,en`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal,
    });

    if (!res.ok) continue;

    const results: any[] = await res.json();
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

/* -------------------- hook types -------------------- */
type StoredGeo = {
  place: string;
  createdAt: number;
  title: string;
  resolved: boolean;
  geo: GeoBox | null; // null when not found
};

type UseOrefGeoBoxesOptions = {
  geocodeDelayMs?: number; // pace BOTH geojson matching and fallback calls
  resetOnNewAlert?: boolean;
  ttlMs?: number;
  fallbackToWebApi?: boolean; // ✅ new
};

/* -------------------- hook -------------------- */
export function useOrefGeoBoxes(
  wsUrl: string,
  options: UseOrefGeoBoxesOptions = {},
) {
  const {
    geocodeDelayMs = 0,
    resetOnNewAlert = false,
    ttlMs = 600_000,
    fallbackToWebApi = true,
  } = options;

  const [latestAlert, setLatestAlert] = useState<OrefAlert | null>(null);

  // store all places, even unresolved
  const [byPlace, setByPlace] = useState<Record<string, StoredGeo>>({});

  // cache resolved GeoBox by original OREF place string
  const cacheRef = useRef<Map<string, GeoBox>>(new Map());
  const lastAlertIdRef = useRef<string | null>(null);

  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

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
            genRef.current++;
            abortRef.current?.abort();
            abortRef.current = null;

            cacheRef.current.clear();
            setByPlace({});
          }

          lastAlertIdRef.current = alert?.id ?? lastAlertIdRef.current;
          setLatestAlert(alert);
        }
      } catch {
        // ignore
      }
    };

    return () => ws.close();
  }, [wsUrl, resetOnNewAlert]);

  /* --------------------
     Resolve:
     1) municipalities.geojson (exact deterministic keys)
     2) if not found => fallback web API (Nominatim) (optional)
     -------------------- */
  useEffect(() => {
    if (!latestAlert?.data?.length) return;

    const myGen = ++genRef.current;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // pre-seed all places so UI always shows them
    setByPlace((prev) => {
      const next = { ...prev };
      for (const place of latestAlert.data) {
        if (!next[place]) {
          next[place] = {
            place,
            createdAt: Date.now(),
            title: latestAlert.title,
            resolved: false,
            geo: null,
          };
        } else {
          next[place] = {
            ...next[place],
            createdAt: Date.now(),
            title: latestAlert.title,
          };
        }
      }
      return next;
    });

    const run = async () => {
      // load geojson/index once
      try {
        await ensureMunicipalitiesLoaded(controller.signal);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        // if GeoJSON fails, we can still try fallback API for all (if enabled)
        // so we do NOT return here; we continue and just skip the geojson part
      }

      for (const place of latestAlert.data) {
        if (genRef.current !== myGen) return;

        // already resolved?
        let alreadyResolved = false;
        setByPlace((prev) => {
          alreadyResolved = !!prev[place]?.resolved;
          return prev;
        });
        if (alreadyResolved) continue;

        // cache hit
        const cached = cacheRef.current.get(place);
        if (cached) {
          if (genRef.current !== myGen) return;
          setByPlace((prev) => ({
            ...prev,
            [place]: {
              place,
              createdAt: Date.now(),
              title: latestAlert.title,
              resolved: true,
              geo: cached,
            },
          }));
          continue;
        }

        // 1) try geojson deterministic keys
        let resolvedGeo: GeoBox | null = null;

        if (geoLoaded) {
          const matched = new Set<Feature>();
          for (const key of buildLookupKeys(place)) {
            const fs = geoIndex.get(key);
            if (fs?.length) fs.forEach((f) => matched.add(f));
          }

          if (matched.size > 0) {
            const f = matched.values().next().value as Feature;
            const ring = outerRingLonLat(f);
            if (ring) {
              const { bbox, center } = bboxFromRing(ring);
              resolvedGeo = {
                place,
                bbox,
                center,
                displayName: place,
                title: place,
              };
            }
          }
        }

        // 2) fallback web API if still not found
        if (!resolvedGeo && fallbackToWebApi) {
          try {
            resolvedGeo = await geocodeFallbackIL(place, controller.signal);
          } catch (e: any) {
            if (e?.name === "AbortError") return;
            // keep unresolved
            resolvedGeo = null;
          }
        }

        if (genRef.current !== myGen) return;

        if (!resolvedGeo) {
          // keep unresolved
          setByPlace((prev) => ({
            ...prev,
            [place]: {
              ...(prev[place] ?? {
                place,
                createdAt: Date.now(),
                title: latestAlert.title,
                resolved: false,
                geo: null,
              }),
              createdAt: Date.now(),
              title: latestAlert.title,
              resolved: false,
              geo: null,
            },
          }));
        } else {
          cacheRef.current.set(place, resolvedGeo);

          setByPlace((prev) => ({
            ...prev,
            [place]: {
              place,
              createdAt: Date.now(),
              title: latestAlert.title,
              resolved: true,
              geo: resolvedGeo,
            },
          }));
        }

        if (geocodeDelayMs > 0) {
          await new Promise((r) => setTimeout(r, geocodeDelayMs));
        }
      }
    };

    run();

    return () => {
      genRef.current++;
      controller.abort();
    };
  }, [latestAlert, geocodeDelayMs, fallbackToWebApi]);

  /* -------------------- TTL cleanup -------------------- */
  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();

      setByPlace((prev) => {
        const next: typeof prev = {};
        for (const key in prev) {
          if (now - prev[key].createdAt < ttlMs) next[key] = prev[key];
        }
        return next;
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [ttlMs]);

  /* -------------------- clear -------------------- */
  const clearAll = () => {
    genRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;

    setByPlace({});
    cacheRef.current.clear();
  };

  /* -------------------- outputs -------------------- */

  const geoBoxes = useMemo(
    () =>
      Object.values(byPlace)
        .filter((x) => x.resolved && x.geo)
        .map((x) => ({ ...(x.geo as GeoBox), title: x.title })),
    [byPlace],
  );

  const unresolvedPlaces = useMemo(
    () =>
      Object.values(byPlace)
        .filter((x) => !x.resolved)
        .map((x) => x.place),
    [byPlace],
  );

  return {
    latestAlert,
    geoBoxes, // resolved only
    geoByPlace: byPlace, // all (geo can be null)
    unresolvedPlaces,
    clearAll,
  };
}
