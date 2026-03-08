/**
 * Trajectory math engine: always compute trajectory toward Iran.
 * Bearing from impact centroid to Iran (Baneh/Mahabad or best-matching base when 150+ areas).
 * Ray extends to Iran border or to the chosen reference point.
 */

import type { GeoPoint } from "../types/oref.types";
import type { TrajectoryResult } from "../types/oref.types";
import type { BoundarySegment } from "./iranBoundary";
import type { IranGeoJsonFeature } from "../hooks/useIranBoundary";
import { centroid, bearing, principalBearingDeg, movePoint, haversineKm } from "./geo";
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

/** Mahabad, northwestern Iran — origin for northern Israel large-pool alerts (lon, lat). */
const MAHABAD: GeoPoint = [45.72, 36.77];

/** Above this area count, principal bearing is unreliable; use bearing to known source. */
const LARGE_POOL_THRESHOLD = 60;

/** Above this area count, match against ir_bases to pick best trajectory source. */
const LARGE_POOL_BASE_THRESHOLD = 150;

/** Angular difference in degrees (0–180). */
function bearingDiff(a: number, b: number): number {
  let d = Math.abs(((a - b) % 360) + 360) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * Pick best Iran base from ir_bases whose bearing from center is closest to principal bearing.
 */
function pickBestBase(
  center: GeoPoint,
  principalBearing: number,
  irBases: GeoPoint[]
): GeoPoint | null {
  if (!irBases.length) return null;
  const principalOpposite = (principalBearing + 180) % 360;
  let best: GeoPoint | null = null;
  let bestDiff = 180;
  for (const base of irBases) {
    const br = bearing(center, base);
    const d = Math.min(bearingDiff(principalBearing, br), bearingDiff(principalOpposite, br));
    if (d < bestDiff) {
      bestDiff = d;
      best = base;
    }
  }
  return best;
}

/**
 * Compute trajectory direction from impact points.
 * For N >= 150, match against ir_bases to pick best source base.
 * @param centerOffsetNorthKm - optional shift of start point.
 * @param areaCount - used for large-pool logic.
 * @param irBases - Iran base coordinates from ir_bases.json; used when areaCount >= 150.
 */
export function computeTrajectory(
  positions: GeoPoint[],
  iranBoundarySegments?: BoundarySegment[] | null,
  iranGeoJson?: IranGeoJsonFeature[] | null,
  centerOffsetNorthKm?: number,
  areaCount?: number,
  irBases?: GeoPoint[] | null
): TrajectoryResult | null {
  if (positions.length < MIN_POSITIONS) return null;

  let center = centroid(positions);
  if (centerOffsetNorthKm != null && centerOffsetNorthKm !== 0) {
    center = movePoint(center, 0, centerOffsetNorthKm);
  }
  const centerLat = center[1];
  const n = areaCount ?? positions.length;

  // Always Iran: pick reference point (south → Baneh; north → Mahabad or best base when 150+)
  const principalBearing = principalBearingDeg(center, positions);
  const useBases = n >= LARGE_POOL_BASE_THRESHOLD && (irBases?.length ?? 0) > 0;
  const bestBase = useBases ? pickBestBase(center, principalBearing, irBases!) : null;

  const iranRef: GeoPoint =
    centerLat <= SOUTH_LAT_MAX
      ? BANEH
      : bestBase ?? MAHABAD;

  const bearingTowardIran = bearing(center, iranRef);

  // Northern Israel with base/Mahabad: extend to that point; else use Iran border intersection
  const extendToPoint = centerLat > SOUTH_LAT_MAX && (bestBase != null || n > LARGE_POOL_THRESHOLD);
  let iranCrossing: GeoPoint;

  if (extendToPoint) {
    const distKm = Math.min(haversineKm(center, iranRef), 1300);
    iranCrossing = movePoint(center, bearingTowardIran, distKm);
  } else {
    const ray = createTrajectoryRay(center, bearingTowardIran);
    iranCrossing =
      findIranBorderCrossing(ray, iranBoundarySegments, iranGeoJson) ??
      movePoint(center, bearingTowardIran, FALLBACK_EXTEND_KM);
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
