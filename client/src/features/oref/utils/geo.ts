/**
 * Geo math: centroid, haversine, local tangent plane, vector helpers.
 */

import type { GeoPoint } from "../types/oref.types";

export type LonLat = GeoPoint;

const EARTH_RADIUS_KM = 6371;

export function centroid(points: LonLat[]): LonLat {
  if (points.length === 0) return [0, 0];
  let sumLon = 0,
    sumLat = 0;
  for (const [lon, lat] of points) {
    sumLon += lon;
    sumLat += lat;
  }
  return [sumLon / points.length, sumLat / points.length];
}

/** Bearing in degrees from A to B (0 = north, 90 = east). */
export function bearing(from: LonLat, to: LonLat): number {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const br = (Math.atan2(y, x) * 180) / Math.PI;
  return (br + 360) % 360;
}

/** Haversine distance in km between two points. */
export function haversineKm(a: LonLat, b: LonLat): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return EARTH_RADIUS_KM * c;
}

/** Convert lon/lat to local XY (meters) around origin. X = east, Y = north. */
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

/** Convert local XY (meters) back to lon/lat. */
export function fromLocalXY(origin: LonLat, xy: [number, number]): LonLat {
  const [lon0, lat0] = origin;
  const [x, y] = xy;
  const lat0Rad = (lat0 * Math.PI) / 180;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(lat0Rad);
  return [lon0 + x / mPerDegLon, lat0 + y / mPerDegLat];
}

/** Vector normalize (2D). */
export function normalize(v: [number, number]): [number, number] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
  if (len === 0) return v;
  return [v[0] / len, v[1] / len];
}

/** Dot product (2D). */
export function dot(a: [number, number], b: [number, number]): number {
  return a[0] * b[0] + a[1] * b[1];
}

/**
 * Compute the principal direction (bearing in degrees) of a set of points around a center.
 * Uses the direction of maximum variance (first principal component) in local tangent plane.
 * Returns bearing 0–360; caller may orient it "toward Iran" (e.g. eastward).
 */
export function principalBearingDeg(center: LonLat, points: LonLat[]): number {
  if (points.length < 2) return 90;
  let sumX = 0,
    sumY = 0,
    sumXX = 0,
    sumYY = 0,
    sumXY = 0;
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

/** Move point by distance (km) in bearing direction (degrees). */
export function movePoint(from: LonLat, bearingDeg: number, distanceKm: number): LonLat {
  const d = distanceKm / EARTH_RADIUS_KM;
  const br = (bearingDeg * Math.PI) / 180;
  const [lon1, lat1] = from;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lon1Rad = (lon1 * Math.PI) / 180;
  const lat2Rad = Math.asin(
    Math.sin(lat1Rad) * Math.cos(d) +
      Math.cos(lat1Rad) * Math.sin(d) * Math.cos(br)
  );
  const lon2Rad =
    lon1Rad +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(lat1Rad),
      Math.cos(d) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    );
  return [(lon2Rad * 180) / Math.PI, (lat2Rad * 180) / Math.PI];
}
