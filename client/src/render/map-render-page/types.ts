/**
 * Render-data response shape for screenshot page (matches server InferenceRenderData + overlay fields).
 */

export interface SettlementMarker {
  id: string;
  name: string;
  lat: number;
  lon: number;
  confidence?: number;
}

export interface MapPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}

export interface RankedCandidatePolygon {
  candidateId: string;
  name: string;
  rank: number;
  score: number;
  polygon: MapPolygon;
}

export interface SummaryLabels {
  confidence: "high" | "medium" | "low";
  estimatedLaunchRegion?: string;
  algorithmVersion: string;
}

/** Trajectory origin point in Iran (screenshot focus). */
export interface TrajectoryOriginPoint {
  lat: number;
  lon: number;
  name?: string;
}

export interface InferenceRenderData {
  alertId: string;
  settlementMarkers: SettlementMarker[];
  clusterPolygon: MapPolygon | null;
  corridorPolygon: MapPolygon | null;
  rankedCandidatePolygons: RankedCandidatePolygon[];
  /** Polyline from impact centroid to Iran origin [lon, lat][]. Optional for backward compat. */
  trajectoryPolyline?: [number, number][];
  /** Point in Iran near trajectory end (screenshot focus). Optional for backward compat. */
  trajectoryOriginPoint?: TrajectoryOriginPoint | null;
  summary: SummaryLabels;
  /** Set by server for overlay */
  receivedAt?: string;
  /** Set by server for overlay */
  impactAreaNames?: string[];
}
