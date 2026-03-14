/**
 * Build an impact cluster from matched settlement geometries.
 * Handles 1 (point buffer), 2 (line buffer), or many (convex hull) settlements.
 */

import type { AlertCluster, LonLat, SettlementGeoMatch } from "../../domain/alerts/types";

const DEG_KM_LAT = 1 / 111.32;
const DEFAULT_POINT_RADIUS_KM = 2;
const DEFAULT_LINE_BUFFER_KM = 1.5;

function toLonLat(m: SettlementGeoMatch): LonLat {
  return [m.lon, m.lat];
}

function kmToDegLat(km: number): number {
  return km * DEG_KM_LAT;
}

function kmToDegLon(km: number, lat: number): number {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  return km / (111.32 * Math.max(0.01, cosLat));
}

/** Bbox as [minLon, minLat, maxLon, maxLat] for GeoJSON */
function bboxFromPoints(points: LonLat[]): [number, number, number, number] {
  if (points.length === 0) return [0, 0, 0, 0];
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of points) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

function centroidOfPoints(points: LonLat[]): LonLat {
  if (points.length === 0) return [0, 0];
  let sumLon = 0, sumLat = 0;
  for (const [lon, lat] of points) {
    sumLon += lon;
    sumLat += lat;
  }
  return [sumLon / points.length, sumLat / points.length];
}

/** Max distance in km from center to any point (Haversine approximation for small distances) */
function radiusKmFromCenter(center: LonLat, points: LonLat[]): number {
  if (points.length === 0) return 0;
  const [cLon, cLat] = center;
  const dLat = DEG_KM_LAT;
  let maxKm = 0;
  for (const [lon, lat] of points) {
    const kmLat = Math.abs(lat - cLat) / dLat;
    const kmLon = Math.abs(lon - cLon) / kmToDegLon(1, cLat);
    const km = Math.sqrt(kmLat * kmLat + kmLon * kmLon);
    if (km > maxKm) maxKm = km;
  }
  return maxKm;
}

/** One ring as array of [lon, lat]; GeoJSON outer ring (CCW). */
function pointBufferRing(center: LonLat, radiusKm: number, segments = 16): LonLat[] {
  const [lon, lat] = center;
  const dLat = kmToDegLat(radiusKm);
  const dLon = kmToDegLon(radiusKm, lat);
  const ring: LonLat[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * 2 * Math.PI;
    ring.push([lon + dLon * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return ring;
}

/** Buffer around a line segment: perpendicular offset, 4 corners (parallelogram). */
function lineBufferRing(a: LonLat, b: LonLat, bufferKm: number): LonLat[] {
  const [ax, ay] = a;
  const [bx, by] = b;
  const midLat = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy) || 1e-10;
  const perpLon = (-dy / len) * kmToDegLon(bufferKm, midLat);
  const perpLat = (dx / len) * kmToDegLat(bufferKm);
  const ring: LonLat[] = [
    [ax + perpLon, ay + perpLat],
    [bx + perpLon, by + perpLat],
    [bx - perpLon, by - perpLat],
    [ax - perpLon, ay - perpLat],
  ];
  return ring;
}

/** Graham scan: convex hull in CCW order (one ring). */
function convexHullRing(points: LonLat[]): LonLat[] {
  if (points.length <= 2) return [...points];
  const pts = points.map((p) => [...p] as LonLat);
  const n = pts.length;
  let start = 0;
  for (let i = 1; i < n; i++) {
    if (pts[i][1] < pts[start][1] || (pts[i][1] === pts[start][1] && pts[i][0] < pts[start][0])) {
      start = i;
    }
  }
  const pivot = pts[start];
  const rest = pts.filter((_, i) => i !== start);
  rest.sort((p, q) => {
    const ap = Math.atan2(p[1] - pivot[1], p[0] - pivot[0]);
    const aq = Math.atan2(q[1] - pivot[1], q[0] - pivot[0]);
    return ap - aq;
  });
  const hull: LonLat[] = [pivot];
  for (const p of rest) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      if (cross <= 0) hull.pop();
      else break;
    }
    hull.push(p);
  }
  return hull;
}

/**
 * Build an impact cluster from matched settlement geometries.
 * - 0 settlements: degenerate cluster (centroid 0,0, empty hull).
 * - 1 settlement: point buffer fallback (small circle).
 * - 2 settlements: line buffer fallback (parallelogram).
 * - 3+: convex hull of points.
 * Output is renderable as GeoJSON (hull = array of rings; bbox = [minLon, minLat, maxLon, maxLat]).
 */
export function buildAlertCluster(
  matches: SettlementGeoMatch[],
  alertId = ""
): AlertCluster {
  const points = matches.map(toLonLat);

  if (points.length === 0) {
    return {
      alertId,
      centroid: [0, 0],
      bbox: [0, 0, 0, 0],
      hull: null,
      radiusKm: 0,
      matchedSettlements: [],
    };
  }

  if (points.length === 1) {
    const center = points[0];
    const radiusKm = DEFAULT_POINT_RADIUS_KM;
    const ring = pointBufferRing(center, radiusKm);
    const bbox = bboxFromPoints(ring);
    return {
      alertId,
      centroid: center,
      bbox,
      hull: [ring],
      radiusKm,
      matchedSettlements: matches,
    };
  }

  if (points.length === 2) {
    const [a, b] = points;
    const center = centroidOfPoints(points);
    const bufferKm = DEFAULT_LINE_BUFFER_KM;
    const ring = lineBufferRing(a, b, bufferKm);
    const bbox = bboxFromPoints(ring);
    const segmentKm =
      radiusKmFromCenter(center, points) * 2;
    const radiusKm = segmentKm / 2 + bufferKm;
    return {
      alertId,
      centroid: center,
      bbox,
      hull: [ring],
      radiusKm,
      matchedSettlements: matches,
    };
  }

  const center = centroidOfPoints(points);
  const ring = convexHullRing(points);
  const bbox = bboxFromPoints(ring);
  const radiusKm = radiusKmFromCenter(center, points);
  return {
    alertId,
    centroid: center,
    bbox,
    hull: [ring],
    radiusKm,
    matchedSettlements: matches,
  };
}
