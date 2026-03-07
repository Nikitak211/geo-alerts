/**
 * Trajectory math engine: direction computed only from impact data (principal bearing).
 * Ray extends to Lebanon border first (if hit), else Iran border or fallback distance.
 */

import type { GeoPoint } from "../types/oref.types";
import type { TrajectoryResult } from "../types/oref.types";
import type { BoundarySegment } from "./iranBoundary";
import type { IranGeoJsonFeature } from "../hooks/useIranBoundary";
import type { LebanonGeoJsonFeature } from "../hooks/useLebanonBoundary";
import { centroid, principalBearingDeg, movePoint } from "./geo";
import { createTrajectoryRay, findIranBorderCrossing } from "./trajectoryRay";
import { intersectLineWithLebanonPolygons } from "./lebanonTurfIntersect";

/** Number of polyline segments from centroid to end. */
const POLYLINE_SEGMENTS = 16;

/** Min areas required for trajectory (must match alertEligibility.MIN_AREA_COUNT). */
const MIN_POSITIONS = 10;

/** Fallback: if ray misses Iran boundary, extend this far (km); 2500 km cap on main map. */
const FALLBACK_EXTEND_KM = 2500;

/** Principal bearing has 180° ambiguity; pick the direction that points east (toward Iran). */
function orientBearingEast(principalBearing: number): number {
  const opposite = (principalBearing + 180) % 360;
  const east = 90;
  const toEast = (b: number) => {
    const d = Math.abs(((b - east + 540) % 360) - 180);
    return Math.min(d, 360 - d);
  };
  const d1 = toEast(principalBearing);
  const d2 = toEast(opposite);
  if (d1 < d2) return principalBearing;
  if (d2 < d1) return opposite;
  // Tie: both equidistant from east (e.g. north-south strip). Default to east (90°)
  // to avoid pointing north toward Russia/Sochi or south toward Egypt.
  return 90;
}

/**
 * Compute trajectory from impact points only: principal bearing (no fixed reference points).
 * Checks Lebanon border first (30–400 km); if hit, trajectory points to Lebanon. Else Iran or fallback.
 */
export function computeTrajectory(
  positions: GeoPoint[],
  iranBoundarySegments?: BoundarySegment[] | null,
  iranGeoJson?: IranGeoJsonFeature[] | null,
  _centerOffsetNorthKm?: number,
  _areaCount?: number,
  _irBases?: GeoPoint[] | null,
  lebanonGeoJson?: LebanonGeoJsonFeature[] | null
): TrajectoryResult | null {
  if (positions.length < MIN_POSITIONS) return null;

  const center = centroid(positions);
  const principalBearing = principalBearingDeg(center, positions);
  const bearingTowardIran = orientBearingEast(principalBearing);

  const lebanonCrossing =
    intersectLineWithLebanonPolygons(center, bearingTowardIran, lebanonGeoJson ?? null);

  if (lebanonCrossing) {
    const polyline: GeoPoint[] = [center];
    for (let i = 1; i < POLYLINE_SEGMENTS; i++) {
      const t = i / POLYLINE_SEGMENTS;
      polyline.push([
        center[0] + (lebanonCrossing[0] - center[0]) * t,
        center[1] + (lebanonCrossing[1] - center[1]) * t,
      ]);
    }
    polyline.push(lebanonCrossing);
    return { polyline, source: "lebanon" };
  }

  const ray = createTrajectoryRay(center, bearingTowardIran);
  const iranCrossing =
    findIranBorderCrossing(ray, iranBoundarySegments, iranGeoJson) ??
    movePoint(center, bearingTowardIran, FALLBACK_EXTEND_KM);

  const polyline: GeoPoint[] = [center];
  for (let i = 1; i < POLYLINE_SEGMENTS; i++) {
    const t = i / POLYLINE_SEGMENTS;
    const lon = center[0] + (iranCrossing[0] - center[0]) * t;
    const lat = center[1] + (iranCrossing[1] - center[1]) * t;
    polyline.push([lon, lat]);
  }
  polyline.push(iranCrossing);

  return { polyline, source: "iran" };
}
