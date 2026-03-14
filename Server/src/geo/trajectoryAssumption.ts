/**
 * Trajectory calculation: direction from impact data only (principal bearing).
 * No fixed reference points; used for render-data/screenshot.
 */

import type { LonLat } from "../domain/alerts/types";
import { destinationPoint, principalBearingDeg } from "./inference/math";

const POLYLINE_SEGMENTS = 16;

/** Max extend distance (km). */
const EXTEND_MAX_KM = 1300;

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

export interface TrajectoryAssumptionResult {
  /** Polyline from impact centroid to end (lon, lat)[]. */
  polyline: LonLat[];
  /** End point (lon, lat). */
  endPoint: LonLat;
}

/**
 * Compute trajectory from impact positions only: principal bearing, no fixed points.
 */
export function computeTrajectoryAssumption(
  center: LonLat,
  positions: LonLat[],
  _areaCount: number,
  _irBasesCoords: LonLat[]
): TrajectoryAssumptionResult | null {
  if (positions.length < 10) return null;

  const principalBearing = principalBearingDeg(center, positions);
  const bearingTowardIran = orientBearingEast(principalBearing);
  const endPoint = destinationPoint(center, bearingTowardIran, EXTEND_MAX_KM);

  const polyline: LonLat[] = [center];
  for (let i = 1; i < POLYLINE_SEGMENTS; i++) {
    const t = i / POLYLINE_SEGMENTS;
    const lon = center[0] + (endPoint[0] - center[0]) * t;
    const lat = center[1] + (endPoint[1] - center[1]) * t;
    polyline.push([lon, lat]);
  }
  polyline.push(endPoint);

  return { polyline, endPoint };
}
