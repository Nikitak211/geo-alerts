/**
 * Load Iran bases from ir_bases.json and pick a randomized origin point
 * near the trajectory (closest base + random distance along trajectory).
 */

import type { LonLat } from "../domain/alerts/types";
import {
  distanceKm,
  destinationPoint,
  bearingBetween,
} from "./inference/math";
import * as fs from "fs";
import * as path from "path";

export interface IrBase {
  coordinates: [number, number]; // [lon, lat]
  name?: string;
}

/** Max offset (km) from the closest base — point stays within this distance of a base in Iran. */
const MAX_OFFSET_KM = 75;

/**
 * Load Iran bases from a GeoJSON file. Returns empty array if path missing or invalid.
 */
export function loadIrBases(dataPath?: string): IrBase[] {
  if (!dataPath) return [];
  let resolved = path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath);
  if (!fs.existsSync(resolved)) {
    // Try relative to server root (e.g. ../client/public/data/ir_bases.json)
    const alt = path.resolve(process.cwd(), "..", "client", "public", "data", "ir_bases.json");
    if (fs.existsSync(alt)) resolved = alt;
    else return [];
  }
  let raw: string;
  try {
    raw = fs.readFileSync(resolved, "utf-8");
  } catch {
    return [];
  }
  let data: { features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: { name?: string } }> };
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const bases: IrBase[] = [];
  for (const f of data.features ?? []) {
    const c = f?.geometry?.coordinates;
    if (Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
      bases.push({
        coordinates: [c[0], c[1]],
        name: f.properties?.name,
      });
    }
  }
  return bases;
}

/**
 * Find the closest Iran base to the given point (trajectory end).
 */
export function findClosestBase(origin: LonLat, bases: IrBase[]): IrBase | null {
  if (!bases.length) return null;
  let best: IrBase | null = null;
  let bestKm = Infinity;
  for (const b of bases) {
    const d = distanceKm(origin, b.coordinates);
    if (d < bestKm) {
      bestKm = d;
      best = b;
    }
  }
  return best;
}

const MAX_RETRIES_INSIDE_IRAN = 12;

/**
 * Place origin at a random point within MAX_OFFSET_KM (75 km) of the closest Iran base,
 * toward the trajectory end. Point is always inside Iran (retry until inside, then fallback to base).
 */
export function pickRandomOriginNearTrajectory(
  originLonLat: LonLat,
  bases: IrBase[],
  options?: {
    isInsideIran?: (point: LonLat) => boolean;
    maxRetries?: number;
  }
): LonLat {
  const base = findClosestBase(originLonLat, bases);
  if (!base) return originLonLat;

  const [baseLon, baseLat] = base.coordinates;
  const [originLon, originLat] = originLonLat;
  const maxRetries = options?.maxRetries ?? MAX_RETRIES_INSIDE_IRAN;
  const isInsideIran = options?.isInsideIran;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const f = Math.random();
    const lon = baseLon + f * (originLon - baseLon);
    const lat = baseLat + f * (originLat - baseLat);
    let point: LonLat = [lon, lat];

    const distKm = distanceKm(base.coordinates, point);
    if (distKm > MAX_OFFSET_KM) {
      const bearing = bearingBetween(base.coordinates, point);
      point = destinationPoint(base.coordinates, bearing, MAX_OFFSET_KM);
    }

    if (!isInsideIran || isInsideIran(point)) return point;
  }

  return [baseLon, baseLat];
}
