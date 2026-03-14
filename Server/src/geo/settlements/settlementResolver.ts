/**
 * Resolve OREF settlement names to coordinates and polygon ids using
 * exact normalized matching first. Unresolved names are returned explicitly.
 */

import * as fs from "fs";
import * as path from "path";
import type { SettlementGeoMatch } from "../../domain/alerts/types";
import type { ResolveSettlementsResult } from "./types";
import { getLookupCandidates } from "./normalizeSettlementName";

/** GeoJSON Feature with optional id and properties */
interface GeoFeature {
  type?: string;
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry?: {
    type: string;
    coordinates?: number[][] | number[][][];
  };
}

interface IndexEntry {
  feature: GeoFeature;
  geometry: GeoFeature["geometry"];
  lat: number;
  lon: number;
  polygonId: string | null;
}

const HEBREW_RANGE = /[\u0590-\u05FF]/;

function extractFeatureNames(props: Record<string, unknown> | undefined): string[] {
  if (!props || typeof props !== "object") return [];
  const strings: string[] = [];
  for (const v of Object.values(props)) {
    if (typeof v === "string" && v.trim()) strings.push(v.trim());
  }
  const heb = strings.filter((s) => HEBREW_RANGE.test(s));
  const ordered = heb.length > 0 ? heb : strings;
  return Array.from(new Set(ordered));
}

function getPolygonId(feature: GeoFeature, names: string[]): string | null {
  if (feature.id != null) return String(feature.id);
  const p = feature.properties;
  if (p && typeof (p as Record<string, unknown>).id !== "undefined") {
    return String((p as Record<string, unknown>).id);
  }
  if (p && typeof (p as Record<string, unknown>).MUN_HEB === "string") {
    return (p as Record<string, unknown>).MUN_HEB as string;
  }
  if (names.length > 0) return names[0];
  return null;
}

function outerRingLonLat(geometry: GeoFeature["geometry"]): [number, number][] | null {
  if (!geometry?.coordinates?.length) return null;
  const c = geometry.coordinates;
  if (geometry.type === "Polygon" && Array.isArray(c[0]) && c[0].length > 0) {
    return c[0] as [number, number][];
  }
  if (
    geometry.type === "MultiPolygon" &&
    Array.isArray(c[0]) &&
    Array.isArray(c[0][0]) &&
    (c[0][0] as unknown[]).length > 0
  ) {
    return (c[0][0] as unknown) as [number, number][];
  }
  return null;
}

function bboxAndCenter(ring: [number, number][]): { lat: number; lon: number } | null {
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
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2,
  };
}

let indexCache: Map<string, IndexEntry[]> | null = null;
let indexPath: string | null = null;

function loadIndex(geojsonPath: string): Map<string, IndexEntry[]> {
  const p = path.resolve(geojsonPath);
  if (indexCache && indexPath === p) return indexCache;
  indexPath = p;
  indexCache = new Map();
  if (!fs.existsSync(p)) return indexCache;
  let raw: string;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch {
    return indexCache;
  }
  let fc: { features?: GeoFeature[] };
  try {
    fc = JSON.parse(raw);
  } catch {
    return indexCache;
  }
  const features = fc?.features;
  if (!Array.isArray(features)) return indexCache;

  for (const f of features) {
    const names = extractFeatureNames(f.properties);
    const geom = f.geometry;
    const ring = outerRingLonLat(geom);
    if (!ring?.length) continue;
    const center = bboxAndCenter(ring);
    if (!center) continue;
    const polygonId = getPolygonId(f, names);
    const entry: IndexEntry = {
      feature: f,
      geometry: geom,
      lat: center.lat,
      lon: center.lon,
      polygonId,
    };
    for (const n of names) {
      for (const key of getLookupCandidates(n)) {
        const k = key.trim();
        if (!k) continue;
        const arr = indexCache!.get(k) ?? [];
        arr.push(entry);
        indexCache!.set(k, arr);
      }
    }
  }
  return indexCache;
}

export interface SettlementResolverOptions {
  /** Path to municipalities GeoJSON; defaults to cwd/municipalities.geojson */
  geojsonPath?: string;
}

/**
 * Resolve a list of settlement names to coordinates and polygon ids.
 * Uses exact normalized matching first. Returns matched items with confidence
 * and unresolved names explicitly (no silent drops).
 */
export function resolveSettlements(
  names: string[],
  options?: SettlementResolverOptions
): ResolveSettlementsResult {
  const geojsonPath =
    options?.geojsonPath ?? path.join(process.cwd(), "municipalities.geojson");
  const index = loadIndex(geojsonPath);

  const matched: SettlementGeoMatch[] = [];
  const unresolved: string[] = [];

  for (const rawName of names) {
    const name = typeof rawName === "string" ? rawName.trim() : "";
    if (!name) continue;

    const candidates = getLookupCandidates(name);
    let entry: IndexEntry | null = null;
    for (const key of candidates) {
      const arr = index.get(key);
      if (arr?.length) {
        entry = arr[0];
        break;
      }
    }

    if (entry) {
      matched.push({
        name,
        lat: entry.lat,
        lon: entry.lon,
        polygonId: entry.polygonId,
        confidence: 1,
      });
    } else {
      unresolved.push(name);
    }
  }

  return { matched, unresolved };
}
