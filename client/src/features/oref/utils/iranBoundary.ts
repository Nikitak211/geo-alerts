/**
 * Iran border for trajectory start-point calculation. Uses ir.json (public/data) when loaded;
 * ray from impact centroid is stretched toward Iran and the first intersection with the
 * border is the trajectory start.
 */

import type { GeoPoint } from "../types/oref.types";
import type { LonLat } from "./geo";
import { toLocalXY, fromLocalXY } from "./geo";

/** Segment = [start, end] in lon/lat. */
export type BoundarySegment = [LonLat, LonLat];

/** Fallback when ir.json is not loaded: simplified western border (Urmia region). */
const IRAN_WESTERN_BOUNDARY_FALLBACK: GeoPoint[] = [
  [44.8, 39.2],
  [45.08, 37.55],
  [45.5, 36.0],
  [46.0, 34.2],
  [45.9, 32.5],
  [46.0, 31.0],
  [45.6, 29.5],
];

/**
 * Parse Iran GeoJSON (FeatureCollection with MultiPolygon/Polygon) into boundary segments.
 * Extracts outer rings only; each segment is [lon, lat] to [lon, lat].
 */
export function parseIranGeoJson(geojson: unknown): BoundarySegment[] {
  const segments: BoundarySegment[] = [];
  const fc = geojson as { type?: string; features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }> };
  if (fc?.type !== "FeatureCollection" || !Array.isArray(fc.features)) return segments;

  for (const feature of fc.features) {
    const geom = feature?.geometry;
    if (!geom) continue;
    const coords = geom.coordinates;
    if (geom.type === "Polygon" && Array.isArray(coords) && coords[0]?.length) {
      const ring = coords[0] as Array<[number, number]>;
      for (let i = 0; i < ring.length - 1; i++) {
        segments.push([[ring[i][0], ring[i][1]], [ring[i + 1][0], ring[i + 1][1]]]);
      }
    } else if (geom.type === "MultiPolygon" && Array.isArray(coords)) {
      for (const polygon of coords) {
        const ring = polygon?.[0];
        if (!Array.isArray(ring)) continue;
        for (let i = 0; i < ring.length - 1; i++) {
          const a = ring[i] as [number, number];
          const b = ring[i + 1] as [number, number];
          segments.push([[a[0], a[1]], [b[0], b[1]]]);
        }
      }
    }
  }
  return segments;
}

/**
 * 2D ray-segment intersection in local XY (meters).
 * Ray: origin (0,0) + t * direction, t >= 0.
 * Segment: A to B.
 * Returns t for the ray (closest positive t), or null if no hit.
 */
function raySegmentIntersection(
  direction: [number, number],
  A: [number, number],
  B: [number, number]
): number | null {
  const [dx, dy] = direction;
  const ux = B[0] - A[0];
  const uy = B[1] - A[1];
  const cross = dx * uy - dy * ux;
  if (Math.abs(cross) < 1e-10) return null;
  const vx = A[0];
  const vy = A[1];
  const t = (vx * uy - vy * ux) / cross;
  const s = (vx * dy - vy * dx) / cross;
  if (t >= 0 && s >= 0 && s <= 1) return t;
  return null;
}

/** Default: reject hits closer than this (meters); avoids wrong segment giving ~100 km line. */
const DEFAULT_MIN_INTERSECTION_M = 400_000;

/** Reject hits farther than this (meters); keeps western border only, not far side of Iran. */
const MAX_INTERSECTION_DISTANCE_M = 1_600_000;

export type IntersectOptions = {
  /** Min distance along ray (meters) for a valid hit. Use 0 to accept any hit (line stops at border). */
  minDistanceM?: number;
  /** Max distance along ray (meters) for a valid hit. Use to reject far-side crossings. */
  maxDistanceM?: number;
};

/**
 * Cast a ray from origin in bearing direction (degrees); find closest intersection
 * with the Iran border at least minDistanceM away.
 * If segments is provided (from ir.json), use it; else use fallback polyline.
 * Returns [lon, lat] of that point or null.
 */
export function intersectRayWithIranBoundary(
  origin: LonLat,
  bearingDeg: number,
  segments?: BoundarySegment[] | null,
  options?: IntersectOptions
): LonLat | null {
  const minM = options?.minDistanceM ?? DEFAULT_MIN_INTERSECTION_M;
  const maxM = options?.maxDistanceM ?? MAX_INTERSECTION_DISTANCE_M;
  const rad = (bearingDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = Math.cos(rad);
  const direction: [number, number] = [dx, dy];

  let bestT: number | null = null;

  if (segments?.length) {
    for (const [a, b] of segments) {
      const A = toLocalXY(origin, a);
      const B = toLocalXY(origin, b);
      const t = raySegmentIntersection(direction, A, B);
      if (t != null && t >= minM && t <= maxM && (bestT == null || t < bestT)) {
        bestT = t;
      }
    }
  } else {
    const boundary = IRAN_WESTERN_BOUNDARY_FALLBACK;
    for (let i = 0; i < boundary.length - 1; i++) {
      const A = toLocalXY(origin, boundary[i]);
      const B = toLocalXY(origin, boundary[i + 1]);
      const t = raySegmentIntersection(direction, A, B);
      if (t != null && t >= minM && t <= maxM && (bestT == null || t < bestT)) {
        bestT = t;
      }
    }
  }

  if (bestT == null) return null;
  const localHit: [number, number] = [
    bestT * direction[0],
    bestT * direction[1],
  ];
  return fromLocalXY(origin, localHit);
}
