/**
 * Trajectory ray: one "invisible line" from impact zone toward Iran.
 * We stretch this line first, then run intersection logic against the Iran border.
 */

import type { GeoPoint } from "../types/oref.types";
import type { BoundarySegment } from "./iranBoundary";
import type { IranGeoJsonFeature } from "../hooks/useIranBoundary";
import { movePoint, haversineKm } from "./geo";
import { intersectRayWithIranBoundary } from "./iranBoundary";
import { intersectLineWithIranPolygons } from "./iranTurfIntersect";

/** Length (km) of the stretched trajectory line used for intersection (must be >= MAX_CROSSING_KM). */
const RAY_LENGTH_KM = 2600;

/** Only accept crossings in this range (km) from ray origin; 2500 km cap on main map. */
const MIN_CROSSING_KM = 400;
const MAX_CROSSING_KM = 2500;

/**
 * The trajectory ray (invisible line): from origin in bearing direction, stretched to endPoint.
 * All intersection logic uses this single line.
 */
export type TrajectoryRay = {
  /** Start of the line (impact side). */
  origin: GeoPoint;
  /** Direction toward Iran (degrees, 0 = north). */
  bearingDeg: number;
  /** End of the stretched line (far toward Iran). */
  endPoint: GeoPoint;
};

/**
 * Create the trajectory ray: stretch an invisible line from origin in bearing direction.
 * Use this same ray for all Iran border intersection calculations.
 */
export function createTrajectoryRay(
  origin: GeoPoint,
  bearingDeg: number
): TrajectoryRay {
  const endPoint = movePoint(origin, bearingDeg, RAY_LENGTH_KM);
  return { origin, bearingDeg, endPoint };
}

function inRange(origin: GeoPoint, p: GeoPoint): boolean {
  const km = haversineKm(origin, p);
  return km >= MIN_CROSSING_KM && km <= MAX_CROSSING_KM;
}

function closestInRange(origin: GeoPoint, candidates: GeoPoint[]): GeoPoint | null {
  let best: GeoPoint | null = null;
  let bestKm = Infinity;
  for (const p of candidates) {
    if (!inRange(origin, p)) continue;
    const km = haversineKm(origin, p);
    if (km < bestKm) {
      bestKm = km;
      best = p;
    }
  }
  return best;
}

/**
 * Find where the trajectory ray (invisible line) **intersects** the Iran border.
 * Returns the **first** intersection along the ray (closest to origin) within the
 * valid range (400–1600 km = western border). Does not use "closest point on border".
 */
export function findIranBorderCrossing(
  ray: TrajectoryRay,
  iranBoundarySegments?: BoundarySegment[] | null,
  iranGeoJson?: IranGeoJsonFeature[] | null
): GeoPoint | null {
  const { origin, bearingDeg } = ray;
  const candidates: GeoPoint[] = [];

  // 1) Segment-based ray–segment intersection (first hit along ray in valid range)
  if (iranBoundarySegments?.length) {
    const hit = intersectRayWithIranBoundary(
      origin,
      bearingDeg,
      iranBoundarySegments
    );
    if (hit != null) candidates.push(hit);
  }

  // 2) Turf line–polygon intersection (same ray; crossings in valid range)
  if (iranGeoJson?.length) {
    const hit = intersectLineWithIranPolygons(
      origin,
      bearingDeg,
      iranGeoJson
    );
    if (hit != null) candidates.push(hit);
  }

  // First intersection = closest to origin among all valid crossings
  return closestInRange(origin, candidates);
}
