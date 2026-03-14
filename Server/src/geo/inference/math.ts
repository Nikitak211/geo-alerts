/**
 * Geodesic / great-circle helpers for corridor and inference.
 * Bearings: 0 = North, 90 = East (standard math).
 */

import type { LonLat } from "../../domain/alerts/types";

export const EARTH_RADIUS_KM = 6371.0088;

/**
 * Destination point given start, bearing (degrees, 0=N 90=E), and distance (km).
 * Great-circle approximation; accurate for corridor-scale distances.
 */
export function destinationPoint(
  start: LonLat,
  bearingDeg: number,
  distanceKm: number
): LonLat {
  const [lon1, lat1] = start;
  const φ1 = (lat1 * Math.PI) / 180;
  const λ1 = (lon1 * Math.PI) / 180;
  const θ = (bearingDeg * Math.PI) / 180;
  const δ = distanceKm / EARTH_RADIUS_KM;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

  return [(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI];
}

/**
 * Normalize bearing to [0, 360) degrees. 0 = North, 90 = East.
 */
export function normalizeBearingDeg(bearingDeg: number): number {
  let d = bearingDeg % 360;
  if (d < 0) d += 360;
  return d;
}

/**
 * Initial bearing from point 1 to point 2 (degrees 0–360).
 * 0 = North, 90 = East.
 */
export function bearingBetween(start: LonLat, end: LonLat): number {
  const [λ1, φ1] = start.map((x) => (x * Math.PI) / 180);
  const [λ2, φ2] = end.map((x) => (x * Math.PI) / 180);
  const Δλ = λ2 - λ1;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return normalizeBearingDeg((θ * 180) / Math.PI);
}

/**
 * Distance between two points (km), Haversine.
 */
export function distanceKm(a: LonLat, b: LonLat): number {
  const [λ1, φ1] = a.map((x) => (x * Math.PI) / 180);
  const [λ2, φ2] = b.map((x) => (x * Math.PI) / 180);
  const dφ = φ2 - φ1;
  const dλ = λ2 - λ1;
  const x =
    Math.sin(dφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Point-in-polygon (ray casting). Ring is array of [lon, lat]; no need to close.
 */
export function pointInPolygon(point: LonLat, ring: LonLat[]): boolean {
  const [x, y] = point;
  const n = ring.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Signed area of a ring (shoelace). Positive = CCW. Use abs for area.
 */
export function ringArea(ring: LonLat[]): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(sum) / 2;
}

/**
 * Centroid of a ring (average of vertices).
 */
export function centroidOfRing(ring: LonLat[]): LonLat {
  if (ring.length === 0) return [0, 0];
  let sx = 0, sy = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    sx += ring[i][0];
    sy += ring[i][1];
  }
  return [sx / n, sy / n];
}

/**
 * Convert lon/lat to local XY (meters) around origin. X = east, Y = north.
 * Used for principal bearing (direction of max variance).
 */
export function toLocalXY(origin: LonLat, point: LonLat): [number, number] {
  const [lon0, lat0] = origin;
  const [lon, lat] = point;
  const lat0Rad = (lat0 * Math.PI) / 180;
  const dLon = ((lon - lon0) * Math.PI) / 180;
  const dLat = ((lat - lat0) * Math.PI) / 180;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(lat0Rad);
  return [dLon * mPerDegLon, dLat * mPerDegLat];
}

/**
 * Principal direction (bearing in degrees) of points around a center.
 * First principal component in local tangent plane; 0–360, 0 = North.
 */
export function principalBearingDeg(center: LonLat, points: LonLat[]): number {
  if (points.length < 2) return 90;
  let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
  for (const p of points) {
    const [x, y] = toLocalXY(center, p);
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumYY += y * y;
    sumXY += x * y;
  }
  const n = points.length;
  const covXX = sumXX / n - (sumX / n) ** 2;
  const covYY = sumYY / n - (sumY / n) ** 2;
  const covXY = sumXY / n - (sumX / n) * (sumY / n);
  const tr = covXX + covYY;
  const det = covXX * covYY - covXY * covXY;
  const disc = tr * tr - 4 * det;
  if (disc < 0) return 90;
  const lambda1 = (tr + Math.sqrt(disc)) / 2;
  const lambda2 = (tr - Math.sqrt(disc)) / 2;
  const lambda = lambda1 >= lambda2 ? lambda1 : lambda2;
  let ex: number, ey: number;
  if (Math.abs(covXY) > 1e-10) {
    ex = covXY;
    ey = lambda - covXX;
  } else {
    ex = lambda - covYY;
    ey = covXY;
  }
  const len = Math.sqrt(ex * ex + ey * ey);
  if (len < 1e-10) return 90;
  ex /= len;
  ey /= len;
  const bearingRad = Math.atan2(ex, ey);
  let bearingDeg = (bearingRad * 180) / Math.PI;
  if (bearingDeg < 0) bearingDeg += 360;
  return bearingDeg;
}
