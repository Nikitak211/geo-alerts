/**
 * WebSocket alert/inference event types and payload shapes.
 * Shared contract for server broadcast and client consumption.
 */

import type { AlertCluster, ReverseCorridor } from "../domain/alerts/types";

/** Event type for enriched inference broadcast (after new alert). */
export const INFERENCE_RESULT = "inference_result";

/** Compact alert summary for WS payload. */
export interface AlertSummary {
  id: string;
  title: string;
  receivedAt: string;
  category: string;
  settlementCount: number;
}

/** Top candidate summary for WS (no geometry). */
export interface TopCandidateSummary {
  candidateId: string;
  name: string;
  rank: number;
  score: number;
  confidence: number;
}

/** Trajectory polyline [lon, lat][] from impact to Iran/Lebanon (screenshot trajectory). */
export type TrajectoryPolyline = [number, number][];

/** Enriched inference payload sent over WS for live map. */
export interface InferenceBroadcastPayload {
  alertSummary: AlertSummary;
  cluster: AlertCluster;
  corridor: ReverseCorridor;
  topCandidates: TopCandidateSummary[];
  confidence: "high" | "medium" | "low";
  algorithmVersion: string;
  /** Server trajectory (screenshot trajectory); use on main map when impact is south. */
  trajectoryPolyline?: TrajectoryPolyline;
  /** "iran" | "lebanon" */
  trajectoryTarget?: "iran" | "lebanon";
}

/** Full WS message for inference_result. */
export interface InferenceResultMessage {
  type: typeof INFERENCE_RESULT;
  ts: number;
  payload: InferenceBroadcastPayload;
}
