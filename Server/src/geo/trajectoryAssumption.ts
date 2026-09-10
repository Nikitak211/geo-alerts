/**
 * Trajectory calculation: direction from impact data only (principal bearing).
 * Algorithm matches client canonical: Lebanon-first (30–400 km), Iran crossing, 2500 km fallback.
 * No fixed reference points; used for render-data/screenshot.
 */

import type { LonLat } from "../domain/alerts/types";
import { destinationPoint, principalBearingDeg } from "./inference/math";
import { findLebanonCrossingAlongRay } from "./lebanonBoundary";
import { findIranBorderCrossingAlongRay } from "./iranBoundary";

const POLYLINE_SEGMENTS = 16;

/** Min positions required for trajectory (matches client MIN_POSITIONS / alertEligibility.MIN_AREA_COUNT). */
const MIN_POSITIONS = 10;

/**
 * Fallback extend distance (km) when ray misses both Lebanon and Iran.
 * Matches client FALLBACK_EXTEND_KM=2500 (previous server value was 1300 — the source of divergence).
 */
const FALLBACK_EXTEND_KM = 2500;

/**
 * Principal bearing has 180° ambiguity; pick the direction that points east (toward Iran).
 * Exported for unit testing.
 */
export function orientBearingEast(principalBearing: number): number {
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

export interface TrajectoryAssumptionResult {
  /** Polyline from impact centroid to end (lon, lat)[]. */
  polyline: LonLat[];
  /** End point (lon, lat). */
  endPoint: LonLat;
  /** Where the trajectory points. Matches client TrajectoryResult source field. */
  source: "lebanon" | "iran" | "fallback";
}

/**
 * Injectable boundary finders for testability.
 * Defaults to the real file-based implementations when omitted.
 */
export interface TrajectoryAssumptionDeps {
  findLebanonCrossing?: (origin: LonLat, bearing: number) => LonLat | null;
  findIranCrossing?: (origin: LonLat, bearing: number) => LonLat | null;
  /** GeoJSON path for Lebanon boundary (used by default finder). */
  lebanonGeoJsonPath?: string;
  /** GeoJSON path for Iran boundary (used by default finder). */
  iranGeoJsonPath?: string;
}

function buildPolyline(center: LonLat, end: LonLat): LonLat[] {
  const polyline: LonLat[] = [center];
  for (let i = 1; i < POLYLINE_SEGMENTS; i++) {
    const t = i / POLYLINE_SEGMENTS;
    polyline.push([
      center[0] + (end[0] - center[0]) * t,
      center[1] + (end[1] - center[1]) * t,
    ]);
  }
  polyline.push(end);
  return polyline;
}

/**
 * Compute trajectory from impact positions only: principal bearing, no fixed points.
 * Algorithm (canonical, matching client trajectory.ts):
 *   1. Check Lebanon border first (30–400 km); if hit → source "lebanon".
 *   2. Check Iran border (400–2500 km); if hit → source "iran".
 *   3. Fallback: extend FALLBACK_EXTEND_KM=2500 → source "fallback".
 */
export function computeTrajectoryAssumption(
  center: LonLat,
  positions: LonLat[],
  _areaCount: number,
  _irBasesCoords: LonLat[],
  deps?: TrajectoryAssumptionDeps
): TrajectoryAssumptionResult | null {
  if (positions.length < MIN_POSITIONS) return null;

  const principalBearing = principalBearingDeg(center, positions);
  const bearingTowardIran = orientBearingEast(principalBearing);

  // Resolve finders: use injected mocks or the real file-based implementations.
  const findLebanon =
    deps?.findLebanonCrossing ??
    ((origin: LonLat, bearing: number) =>
      findLebanonCrossingAlongRay(origin, bearing, deps?.lebanonGeoJsonPath));

  const findIran =
    deps?.findIranCrossing ??
    ((origin: LonLat, bearing: number) =>
      findIranBorderCrossingAlongRay(origin, bearing, deps?.iranGeoJsonPath));

  // Lebanon first (matches client logic).
  const lebanonCrossing = findLebanon(center, bearingTowardIran);
  if (lebanonCrossing) {
    return {
      polyline: buildPolyline(center, lebanonCrossing),
      endPoint: lebanonCrossing,
      source: "lebanon",
    };
  }

  // Iran crossing, or fallback to FALLBACK_EXTEND_KM.
  const iranCrossing = findIran(center, bearingTowardIran);
  if (iranCrossing) {
    return {
      polyline: buildPolyline(center, iranCrossing),
      endPoint: iranCrossing,
      source: "iran",
    };
  }

  const fallbackEnd = destinationPoint(center, bearingTowardIran, FALLBACK_EXTEND_KM);
  return {
    polyline: buildPolyline(center, fallbackEnd),
    endPoint: fallbackEnd,
    source: "fallback",
  };
}
