/**
 * Types for approach-side / proximity inference (neutral geometry, no origin country).
 */

import type { Feature, LineString, Polygon } from "geojson";

export type ApproachSide = "north" | "south" | "east" | "west" | "unknown";

export type LonLat = { lng: number; lat: number };

/** Input: a place with coordinates (lng/lat for Turf, or lat/lng by name). */
export type AlertPlace = { name: string; lat: number; lng: number };

export type ProximityResult = {
  /** Cluster center (centroid of alert points). */
  center: LonLat;
  /** Convex hull of alert points (threat envelope). */
  hull: Feature<Polygon> | null;
  /** Which boundary side is nearest = approach/entry side. */
  approachSide: ApproachSide;
  /** Distance in km from center to nearest boundary point. */
  nearestBoundaryDistanceKm: number;
  /** Point on the boundary that is nearest to the cluster. */
  nearestBoundaryPoint: LonLat | null;
};

export type BoundarySet = {
  north: Feature<LineString>;
  south: Feature<LineString>;
  east: Feature<LineString>;
  west: Feature<LineString>;
};
