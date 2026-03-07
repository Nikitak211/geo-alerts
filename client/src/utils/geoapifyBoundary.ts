/**
 * Fetch boundary polygon via Geoapify Boundaries API (part-of by coordinates).
 * Uses lat/lon from cities.json; requests are queued one at a time to avoid rate limits.
 * @see https://api.geoapify.com/v1/boundaries/part-of?lon=...&lat=...&geometry=geometry_1000&apiKey=...
 */

const GEOAPIFY_PART_OF = "https://api.geoapify.com/v1/boundaries/part-of";

export type BoundaryPolygonResult = {
  displayName: string;
  /** GeoJSON Polygon coordinates: [ outer ring ], outer ring = [ [lon, lat], ... ] */
  coordinates: number[][][];
};

function getApiKey(): string {
  return String(process.env.REACT_APP_GEOAPIFY_API_KEY).trim();
}

type GeoJSONFeature = {
  type: "Feature";
  geometry?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][] | number[][][];
  };
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features?: GeoJSONFeature[];
};

/** Extract outer ring [ [lon, lat], ... ] from GeoJSON Polygon or MultiPolygon. */
function extractOuterRing(feature: GeoJSONFeature): [number, number][] | null {
  const g = feature?.geometry;
  if (!g?.coordinates) return null;
  if (g.type === "Polygon") {
    const coords = g.coordinates as unknown as [number, number][][];
    const ring = coords[0];
    return Array.isArray(ring) && ring.length >= 3 ? ring : null;
  }
  if (g.type === "MultiPolygon") {
    const coords = g.coordinates as unknown as [number, number][][][];
    const ring = coords[0]?.[0];
    return Array.isArray(ring) && ring.length >= 3 ? ring : null;
  }
  return null;
}

/** Rough area of ring in degree² (smaller = more granular boundary, e.g. city). */
function ringAreaDeg2(ring: [number, number][]): number {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return (maxLon - minLon) * (maxLat - minLat);
}

/** Single request: fetch boundary polygon for a point (lat, lon). Picks the smallest (most granular) polygon so we get city-level, not region. */
export async function fetchGeoapifyBoundaryPolygon(
  lat: number,
  lon: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<BoundaryPolygonResult | null> {
  if (!apiKey || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const url = `${GEOAPIFY_PART_OF}?lon=${encodeURIComponent(lon)}&lat=${encodeURIComponent(lat)}&geometry=geometry_1000&apiKey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { signal });
  if (!res.ok) return null;

  const data = (await res.json()) as GeoJSONFeatureCollection;
  const features = data?.features ?? [];
  let best: { ring: [number, number][]; displayName: string } | null = null;
  let bestArea = Infinity;

  for (const f of features) {
    const ring = extractOuterRing(f);
    if (!ring?.length) continue;
    const area = ringAreaDeg2(ring);
    if (area < bestArea && area > 0) {
      if (
        ring[0][0] !== ring[ring.length - 1][0] ||
        ring[0][1] !== ring[ring.length - 1][1]
      ) {
        ring.push([ring[0][0], ring[0][1]]);
      }
      bestArea = area;
      best = {
        ring,
        displayName:
          f.properties?.name ?? f.properties?.city ?? f.properties?.state ?? "",
      };
    }
  }

  if (!best) return null;
  return { displayName: best.displayName, coordinates: [best.ring] };
}

/* -------------------- Queue: one request at a time -------------------- */

type QueuedJob = {
  lat: number;
  lon: number;
  resolve: (r: BoundaryPolygonResult | null) => void;
  reject: (err: unknown) => void;
  signal?: AbortSignal;
};

let queue: QueuedJob[] = [];
let processing = false;
const DELAY_MS = 400;

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;
  const apiKey = getApiKey();
  while (queue.length > 0 && apiKey) {
    const job = queue.shift()!;
    try {
      const result = await fetchGeoapifyBoundaryPolygon(
        job.lat,
        job.lon,
        apiKey,
        job.signal,
      );
      job.resolve(result);
    } catch (e) {
      job.reject(e);
    }
    if (queue.length > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  processing = false;
}

/**
 * Fetch boundary polygon for (lat, lon) via Geoapify part-of.
 * Requests are queued and processed one at a time with a short delay to avoid rate limits.
 * Set VITE_GEOAPIFY_API_KEY in .env to enable.
 */
let apiKeyWarned = false;
export function fetchGeoapifyBoundaryQueued(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<BoundaryPolygonResult | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    if (!apiKeyWarned) {
      apiKeyWarned = true;
      console.warn(
        "[Geoapify] No API key. Add REACT_APP_GEOAPIFY_API_KEY to client/.env and restart (npm start).",
      );
    }
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    queue.push({ lat, lon, resolve, reject, signal });
    processQueue();
  });
}
