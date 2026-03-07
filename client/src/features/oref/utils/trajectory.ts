/**
 * Trajectory math engine: compute direction from the alert impact geometry (no hardcoded Iran).
 * 1) Principal direction of impact points (axis of spread). 2) Orient toward Iran (eastward).
 * 3) Ray from center along that bearing; first intersection with Iran border = trajectory end.
 */

import type { GeoPoint } from "../types/oref.types";
import type { TrajectoryResult } from "../types/oref.types";
import type { BoundarySegment } from "./iranBoundary";
import type { IranGeoJsonFeature } from "../hooks/useIranBoundary";
import { centroid, bearing, principalBearingDeg, movePoint } from "./geo";
import { createTrajectoryRay, findIranBorderCrossing } from "./trajectoryRay";

/** Number of polyline segments from centroid to Iran border. */
const POLYLINE_SEGMENTS = 16;

/** Min areas required for trajectory (must match alertEligibility.MIN_AREA_COUNT). */
const MIN_POSITIONS = 10;

/** Fallback: if ray misses boundary, extend this far (km). */
const FALLBACK_EXTEND_KM = 1200;

/** South / Negev-heavy alerts: centroid lat at or below this → use Baneh bearing (western Iran). */
const SOUTH_LAT_MAX = 31.6;

/** Baneh, western Iran — origin for southern Israel alerts (lon, lat). */
const BANEH: GeoPoint = [45.88, 35.99];

/**
 * Orient principal bearing so it points toward Iran (eastern hemisphere, 0°–180°).
 * Principal axis has two directions; pick the one that points east (not west).
 */
function orientBearingTowardIran(bearingDeg: number): number {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  if (normalized <= 180) return normalized;
  return normalized - 180;
}

/**
 * Compute trajectory direction from impact points only (algorithm, no hardcoded Iran locations).
 * Uses principal direction of the point cloud (axis of maximum spread), oriented toward Iran,
 * then first intersection with Iran border.
 * @param centerOffsetNorthKm - optional shift of start point (e.g. for 40-area alerts).
 */
export function computeTrajectory(
  positions: GeoPoint[],
  iranBoundarySegments?: BoundarySegment[] | null,
  iranGeoJson?: IranGeoJsonFeature[] | null,
  centerOffsetNorthKm?: number
): TrajectoryResult | null {
  if (positions.length < MIN_POSITIONS) return null;

  let center = centroid(positions);
  if (centerOffsetNorthKm != null && centerOffsetNorthKm !== 0) {
    center = movePoint(center, 0, centerOffsetNorthKm);
  }
  const centerLat = center[1];
  const bearingTowardIran =
    centerLat <= SOUTH_LAT_MAX
      ? bearing(center, BANEH)
      : orientBearingTowardIran(principalBearingDeg(center, positions));

  // 1) Stretch the invisible trajectory line (same line for all intersection logic)
  const ray = createTrajectoryRay(center, bearingTowardIran);

  // 2) Find first intersection of this line with the Iran border (not "closest point on border")
  let iranCrossing = findIranBorderCrossing(
    ray,
    iranBoundarySegments,
    iranGeoJson
  );
  if (iranCrossing == null) {
    iranCrossing = movePoint(center, bearingTowardIran, FALLBACK_EXTEND_KM);
  }

  // 3) Polyline: start at impact, end at intersection (or fallback point)
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
