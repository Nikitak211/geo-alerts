/**
 * Iran candidate region types. Aligns with domain CandidateLaunchArea;
 * priority is used for ordering/scoring.
 */

import type { CandidateLaunchArea } from "../../domain/alerts/types";

export type { CandidateLaunchArea };

/** Candidate feature as loaded from GeoJSON (id, name, type, priority, geometry). */
export interface IranCandidateFeature extends CandidateLaunchArea {
  /** Load order / priority (lower = higher priority). */
  priority: number;
}

/** GeoJSON Feature properties for Iran candidate regions. */
export interface IranCandidateProperties {
  id: string;
  name: string;
  type: string;
  priority: number;
}
