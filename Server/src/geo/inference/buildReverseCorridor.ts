/**
 * Build a reverse directional corridor from the Israel impact cluster toward Iran.
 * Directional uncertainty corridor only; no precise ballistic path.
 * Input: cluster (centroid, bbox, radiusKm, hull). Output: GeoJSON-style polygon corridor.
 */

import type { AlertCluster, LonLat, ReverseCorridor } from "../../domain/alerts/types";
import { destinationPoint, distanceKm, normalizeBearingDeg } from "./math";

export interface ReverseCorridorOptions {
  /** Minimum center bearing (degrees, 0=N 90=E). Default 60 (east-northeast). */
  minBearingDeg?: number;
  /** Maximum center bearing. Default 100 (east-southeast). */
  maxBearingDeg?: number;
  /** Base corridor half-spread (degrees). Widened by cluster uncertainty. Default 14. */
  spreadDeg?: number;
  /** Maximum corridor length (km). If omitted, computed from cluster to western Iran reference. */
  maxDistanceKm?: number;
  /** Minimum half-spread (degrees). Default 8. */
  minSpreadDeg?: number;
  /** Maximum half-spread (degrees). Default 30. */
  maxSpreadDeg?: number;
  /** Km of cluster radius that adds 1 degree to half-spread. Default 0.8. */
  spreadPerRadiusKm?: number;
}

/** Options required for spread/bearing (maxDistanceKm not needed). */
type CorridorSpreadOptions = Required<Omit<ReverseCorridorOptions, "maxDistanceKm">>;

/** Western Iran reference (lon, lat) used only to compute corridor length from cluster. */
const WESTERN_IRAN_REF: LonLat = [48, 34];

const MIN_CORRIDOR_KM = 800;
const MAX_CORRIDOR_KM = 1500;

const DEFAULT_OPTIONS: Omit<Required<ReverseCorridorOptions>, "maxDistanceKm"> & {
  maxDistanceKm?: number;
} = {
  minBearingDeg: 60,
  maxBearingDeg: 100,
  spreadDeg: 14,
  minSpreadDeg: 8,
  maxSpreadDeg: 30,
  spreadPerRadiusKm: 0.8,
};

/**
 * Half-spread (degrees) from cluster uncertainty: compact cluster => narrower, wide => wider.
 * Uses bbox and radiusKm only (hull optional); safe when hull is null.
 */
export function halfSpreadDegFromCluster(
  cluster: AlertCluster,
  options: CorridorSpreadOptions
): number {
  const [minLon, minLat, maxLon, maxLat] = cluster.bbox;
  const latSpan = maxLat - minLat;
  const lonSpan = maxLon - minLon;
  const hasNorthSouthSpread = latSpan > lonSpan * 1.2;
  let halfSpreadDeg = options.spreadDeg;
  if (hasNorthSouthSpread) halfSpreadDeg += 6;
  halfSpreadDeg += cluster.radiusKm * options.spreadPerRadiusKm;
  return Math.max(
    options.minSpreadDeg,
    Math.min(options.maxSpreadDeg, halfSpreadDeg)
  );
}

/**
 * Infer center bearing (eastward toward Iran) and half-spread from cluster.
 */
function inferCorridorParams(
  cluster: AlertCluster,
  options: CorridorSpreadOptions
): { centerBearingDeg: number; halfSpreadDeg: number } {
  const centerBearingDeg = (options.minBearingDeg + options.maxBearingDeg) / 2;
  const halfSpreadDeg = halfSpreadDegFromCluster(cluster, options);
  return { centerBearingDeg, halfSpreadDeg };
}

/**
 * Compute corridor max distance (km) from cluster centroid to western Iran reference, clamped.
 */
function computeMaxDistanceKm(cluster: AlertCluster): number {
  const d = distanceKm(cluster.centroid, WESTERN_IRAN_REF);
  return Math.round(Math.max(MIN_CORRIDOR_KM, Math.min(MAX_CORRIDOR_KM, d)));
}

/**
 * Build a reverse launch corridor polygon from the cluster centroid
 * toward Iran (east / east-northeast / east-southeast). Cone/trapezoid
 * with left and right edges; no single launch point.
 * maxDistanceKm is computed from cluster to western Iran if not provided.
 */
export function buildReverseCorridor(
  cluster: AlertCluster,
  options?: ReverseCorridorOptions
): ReverseCorridor {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxDistanceKm =
    opts.maxDistanceKm ?? computeMaxDistanceKm(cluster);
  const startPoint: LonLat = [...cluster.centroid];
  const { centerBearingDeg, halfSpreadDeg } = inferCorridorParams(cluster, opts);
  const spreadDeg = halfSpreadDeg * 2;

  const rightBearing = normalizeBearingDeg(centerBearingDeg + halfSpreadDeg);
  const leftBearing = normalizeBearingDeg(centerBearingDeg - halfSpreadDeg);

  const rightFar = destinationPoint(startPoint, rightBearing, maxDistanceKm);
  const leftFar = destinationPoint(startPoint, leftBearing, maxDistanceKm);
  const endPoint = destinationPoint(startPoint, centerBearingDeg, maxDistanceKm);

  /* CCW ring so interior (corridor) is on the left when walking: start → left → right → start */
  const ring: LonLat[] = [startPoint, leftFar, rightFar, startPoint];
  const polygon: LonLat[][] = [ring];

  return {
    startPoint,
    endPoint,
    centerBearingDeg,
    spreadDeg,
    maxDistanceKm,
    polygon,
  };
}
