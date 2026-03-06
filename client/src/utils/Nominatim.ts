import type { GeoBox } from "../types";

type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

type GeoJSONFeature = {
  type: "Feature";
  properties?: Record<string, any>;
  geometry?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any;
  };
};

const MUNICIPALITIES_URL = "/data/municipalities.geojson";

let cachedFc: GeoJSONFeatureCollection | null = null;
let cachedIndex: Map<string, GeoJSONFeature> | null = null;
let loadingPromise: Promise<void> | null = null;

const normalize = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    // normalize hyphens
    .replace(/[‐-‒–—−]/g, "-")
    // remove quotes-ish
    .replace(/[׳״"']/g, "");

function getNameFromProps(props: Record<string, any> | undefined): string[] {
  if (!props) return [];

  // common candidates; keep a few fallbacks
  const keys = [
    "name_he",
    "שם_ישוב",
    "שם_ישוב_עברית",
    "שם",
    "name",
    "NAME_HE",
    "SHEM_YISHUV",
  ];

  const names: string[] = [];
  for (const k of keys) {
    const v = props[k];
    if (typeof v === "string" && v.trim()) names.push(v.trim());
  }

  // also scan all props for a Hebrew-ish name string if above failed
  if (names.length === 0) {
    for (const v of Object.values(props)) {
      if (typeof v === "string" && /[\u0590-\u05FF]/.test(v)) {
        names.push(v.trim());
      }
    }
  }

  return Array.from(new Set(names));
}

async function ensureLoaded(signal?: AbortSignal) {
  if (cachedFc && cachedIndex) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const res = await fetch(MUNICIPALITIES_URL, {
      headers: { Accept: "application/json" },
      signal,
    });

    if (!res.ok) {
      throw new Error(
        `Failed to load ${MUNICIPALITIES_URL} (HTTP ${res.status})`,
      );
    }

    const fc = (await res.json()) as GeoJSONFeatureCollection;

    const idx = new Map<string, GeoJSONFeature>();
    for (const f of fc.features ?? []) {
      const names = getNameFromProps(f.properties);
      for (const n of names) {
        idx.set(normalize(n), f);
      }
    }

    cachedFc = fc;
    cachedIndex = idx;
  })().finally(() => {
    loadingPromise = null;
  });

  return loadingPromise;
}

/**
 * Returns the OUTER RING coordinates (polygon[0]) in lon/lat pairs.
 * - Polygon: coordinates = [ring1, ring2...]
 * - MultiPolygon: coordinates = [[ring1,...],[...],...]
 */
function getOuterRingLonLat(
  feature: GeoJSONFeature,
): [number, number][] | null {
  const g = feature.geometry;
  if (!g) return null;

  if (g.type === "Polygon") {
    const rings = g.coordinates as [number, number][][];
    const outer = rings?.[0];
    if (!outer?.length) return null;
    return outer as [number, number][];
  }

  if (g.type === "MultiPolygon") {
    const polys = g.coordinates as [number, number][][][];
    const firstPoly = polys?.[0];
    const outer = firstPoly?.[0];
    if (!outer?.length) return null;
    return outer as [number, number][];
  }

  return null;
}

function bboxFromOuterRing(outerRing: [number, number][]) {
  // coordinates are [lon, lat]
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of outerRing) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  // bbox in your format: [south, north, west, east] = [minLat, maxLat, minLon, maxLon]
  const bbox: [number, number, number, number] = [
    minLat,
    maxLat,
    minLon,
    maxLon,
  ];

  const center = {
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2,
  };

  return { bbox, center };
}

export async function geocodeIL(
  place: string,
  signal?: AbortSignal,
): Promise<GeoBox | null> {
  await ensureLoaded(signal);

  const idx = cachedIndex!;
  const f = idx.get(normalize(place));

  if (!f) return null;

  const outer = getOuterRingLonLat(f);
  if (!outer) return null;

  const { bbox, center } = bboxFromOuterRing(outer);

  const displayName = getNameFromProps(f.properties)[0] ?? place;

  return {
    place,
    bbox,
    center,
    displayName,
    title: displayName,
    // If you want to return the polygon ring too, add it to GeoBox type.
    // polygon: outer,
  };
}
