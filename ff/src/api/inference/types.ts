/**
 * API response types for inference and render-data.
 */

import type { LonLat } from "../../domain/alerts/types";

/** Single settlement marker for map */
export interface SettlementMarker {
  id: string;
  name: string;
  lat: number;
  lon: number;
  confidence?: number;
}

/** GeoJSON-style polygon (single ring = one array of [lon,lat]) */
export interface MapPolygon {
  type: "Polygon";
  coordinates: LonLat[][];
}

/** Ranked candidate with geometry for rendering */
export interface RankedCandidatePolygon {
  candidateId: string;
  name: string;
  rank: number;
  score: number;
  polygon: MapPolygon;
}

/** Summary labels for UI */
export interface SummaryLabels {
  confidence: "high" | "medium" | "low";
  /** Human-readable confidence label from confidence bands. */
  confidenceLabel?: string;
  estimatedLaunchRegion?: string;
  algorithmVersion: string;
}

/** Trajectory origin point (Iran or Lebanon border). */
export interface TrajectoryOriginPoint {
  lat: number;
  lon: number;
  /** Optional: name of best candidate region. */
  name?: string;
}

/** Where the trajectory points; Lebanon → no screenshot. */
export type TrajectoryTarget = "iran" | "lebanon";

/** Fully prepared map data for frontend (no inference math). */
export interface InferenceRenderData {
  alertId: string;
  settlementMarkers: SettlementMarker[];
  clusterPolygon: MapPolygon | null;
  corridorPolygon: MapPolygon | null;
  rankedCandidatePolygons: RankedCandidatePolygon[];
  /** Polyline from impact centroid to trajectory end (Iran or Lebanon). */
  trajectoryPolyline: [number, number][];
  /** Point at trajectory end (screenshot focus when Iran; never screenshot when Lebanon). */
  trajectoryOriginPoint: TrajectoryOriginPoint | null;
  /** When "lebanon", trajectory points to Lebanon — do not take screenshot. */
  trajectoryTarget: TrajectoryTarget;
  summary: SummaryLabels;
}
