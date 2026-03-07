/**
 * Load Iran country boundary and check if a point is inside Iran.
 * Used to ensure randomized trajectory origin stays within Iran borders.
 * Also provides ray–border crossing for trajectory end (screenshot point on trajectory).
 */

import * as fs from "fs";
import * as path from "path";
import type { LonLat } from "../domain/alerts/types";
import { pointInPolygon, destinationPoint } from "./inference/math";

type LonLatRing = [number, number][];

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

/**
 * Return a function that tests if a point [lon, lat] is inside Iran.
 * Uses client/public/data/ir.json if path not given (resolved from this file's location).
 */
export function createIsPointInIran(iranGeoJsonPath?: string): (point: LonLat) => boolean {
  const defaultPath = path.resolve(__dirname, "..", "..", "client", "public", "data", "ir.json");
  const filePath = iranGeoJsonPath
    ? (path.isAbsolute(iranGeoJsonPath) ? iranGeoJsonPath : path.resolve(process.cwd(), iranGeoJsonPath))
    : defaultPath;
  const rings = parseRingsFromGeoJson(filePath);
  return (point: LonLat): boolean => {
    if (rings.length === 0) return false;
    for (const ring of rings) {
      if (pointInPolygon(point, ring)) return true;
    }
    return false;
  };
}

/** Western/southern Iran border: 400–2500 km to match main map cap; screenshot and trajectory align. */
const MIN_IRAN_CROSSING_KM = 400;
const MAX_IRAN_CROSSING_KM = 2500;
const IRAN_CROSSING_STEP_KM = 10;

function isPointInIranRings(point: LonLat, rings: LonLatRing[]): boolean {
  for (const ring of rings) {
    if (pointInPolygon(point, ring)) return true;
  }
  return false;
}

/**
 * Find the first point along the ray (from origin in bearing direction) that is inside Iran.
 * Used to put the screenshot/link point on the trajectory at the Iran border (not in sea, not fixed fallback).
 */
export function findIranBorderCrossingAlongRay(
  origin: LonLat,
  bearingDeg: number,
  iranGeoJsonPath?: string
): LonLat | null {
  const defaultPath = path.resolve(
    __dirname,
    "..",
    "..",
    "client",
    "public",
    "data",
    "ir.json"
  );
  const filePath = iranGeoJsonPath
    ? (path.isAbsolute(iranGeoJsonPath) ? iranGeoJsonPath : path.resolve(process.cwd(), iranGeoJsonPath))
    : defaultPath;
  const rings = parseRingsFromGeoJson(filePath);
  if (rings.length === 0) return null;

  for (let km = MIN_IRAN_CROSSING_KM; km <= MAX_IRAN_CROSSING_KM; km += IRAN_CROSSING_STEP_KM) {
    const p = destinationPoint(origin, bearingDeg, km);
    if (isPointInIranRings(p, rings)) return p;
  }
  return null;
}
