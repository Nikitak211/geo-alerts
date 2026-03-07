/**
 * Strong TypeScript types for OREF trajectory feature.
 */

/** [longitude, latitude] — matches Cesium order. */
export type GeoPoint = [number, number];

/** Single area in an alert with resolved position. */
export type OrefArea = {
  name: string;
  /** [lon, lat]. Invalid if lat === 0 && lon === 0. */
  point: GeoPoint;
};

/** Normalized OREF alert with typed areas (used after eligibility). */
export type OrefAlert = {
  id: string;
  title: string;
  data: string[];
  /** At least 3 valid areas for trajectory (more → better direction fit). */
  areas: OrefArea[];
  time?: Date;
};

/** Internal normalized alert before area validation (positions may be invalid). */
export type OrefNormalizedAlert = {
  id: string;
  title: string;
  data: string[];
  positions: GeoPoint[];
  time?: Date;
};

export type TrajectoryInput = {
  positions: GeoPoint[];
  alertId: string;
};

/** Detected source corridor label. */
export type TrajectorySource = "lebanon" | "iran" | "unknown";

/** Result of trajectory engine: polyline + detected source. */
export type TrajectoryResult = {
  /** Polyline from border (Iran/Lebanon side) to impact centroid; multiple points for smooth render. */
  polyline: GeoPoint[];
  source: TrajectorySource;
};
