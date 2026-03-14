/**
 * Lebanon border (lb.json): detect when trajectory ray hits Lebanon.
 * Used to show trajectory pointing to Lebanon and to skip screenshots.
 */

import * as fs from "fs";
import * as path from "path";
import type { LonLat } from "../domain/alerts/types";
import { destinationPoint } from "./inference/math";
import { pointInPolygon } from "./inference/math";

type LonLatRing = [number, number][];

/** Lebanon is ~30–400 km from northern Israel. */
const MIN_LEBANON_KM = 30;
const MAX_LEBANON_KM = 400;
const STEP_KM = 5;

let cachedRings: LonLatRing[] | null = null;
let cachedPath: string | null = null;

function parseRingsFromGeoJson(filePath: string): LonLatRing[] {
  if (cachedRings && cachedPath === filePath) return cachedRings;
  if (!fs.existsSync(filePath)) return [];
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }
  let data: {
    type?: string;
    features?: Array<{
      geometry?: {
        type?: string;
        coordinates?: LonLatRing[] | LonLatRing[][][];
      };
    }>;
  };
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const rings: LonLatRing[] = [];
  for (const f of data.features ?? []) {
    const geom = f?.geometry;
    if (!geom?.coordinates) continue;
    if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
      const ring = geom.coordinates[0];
      if (ring?.length >= 3) rings.push(ring as LonLatRing);
    } else if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
      const polygons = geom.coordinates as unknown as LonLatRing[][];
      for (const poly of polygons) {
        const ring = poly?.[0];
        if (ring?.length >= 3) rings.push(ring);
      }
    }
  }
  cachedRings = rings;
  cachedPath = filePath;
  return rings;
}

function isPointInLebanon(point: LonLat, rings: LonLatRing[]): boolean {
  for (const ring of rings) {
    if (pointInPolygon(point, ring)) return true;
  }
  return false;
}

/**
 * Find the first point along the ray (from origin in bearing direction) that is inside Lebanon.
 * Only considers range [MIN_LEBANON_KM, MAX_LEBANON_KM]. Returns null if ray does not hit Lebanon.
 */
export function findLebanonCrossingAlongRay(
  origin: LonLat,
  bearingDeg: number,
  lebanonGeoJsonPath?: string
): LonLat | null {
  const defaultPath = path.resolve(
    __dirname,
    "..",
    "..",
    "client",
    "public",
    "data",
    "lb.json"
  );
  const filePath = lebanonGeoJsonPath
    ? path.isAbsolute(lebanonGeoJsonPath)
      ? lebanonGeoJsonPath
      : path.resolve(process.cwd(), lebanonGeoJsonPath)
    : defaultPath;
  const rings = parseRingsFromGeoJson(filePath);
  if (rings.length === 0) return null;

  for (let km = MIN_LEBANON_KM; km <= MAX_LEBANON_KM; km += STEP_KM) {
    const p = destinationPoint(origin, bearingDeg, km);
    if (isPointInLebanon(p, rings)) return p;
  }
  return null;
}
