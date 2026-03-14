/**
 * Persist inference result (cluster, corridor, ranked candidates) for replay/debugging.
 */

import type { Pool } from "pg";
import type {
  AlertCluster,
  ReverseCorridor,
  CandidateScore,
} from "../../domain/alerts/types";

export interface InferenceSummary {
  confidence: "high" | "medium" | "low";
  estimatedLaunchRegion?: string;
}

export interface PersistInferenceRow {
  alertId: string;
  cluster: AlertCluster;
  corridor: ReverseCorridor;
  rankedCandidates: CandidateScore[];
  algorithmVersion: string;
  summary: InferenceSummary;
}

/**
 * Insert inference result for an alert.
 */
export async function persistInference(
  pool: Pool,
  row: PersistInferenceRow
): Promise<number> {
  const res = await pool.query(
    `INSERT INTO inference_results (alert_id, cluster, corridor, ranked_candidates, algorithm_version, summary)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      row.alertId,
      JSON.stringify(row.cluster),
      JSON.stringify(row.corridor),
      JSON.stringify(row.rankedCandidates),
      row.algorithmVersion,
      JSON.stringify(row.summary),
    ]
  );
  return res.rows[0]?.id;
}

/**
 * Get latest inference result by alert id for replay.
 */
export async function getInferenceByAlertId(
  pool: Pool,
  alertId: string
): Promise<(PersistInferenceRow & { id: number; createdAt: string }) | null> {
  const res = await pool.query(
    `SELECT id, alert_id, cluster, corridor, ranked_candidates, algorithm_version, summary, created_at
     FROM inference_results WHERE alert_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [alertId]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    alertId: row.alert_id,
    cluster: row.cluster as AlertCluster,
    corridor: row.corridor as ReverseCorridor,
    rankedCandidates: row.ranked_candidates as CandidateScore[],
    algorithmVersion: row.algorithm_version,
    summary: (row.summary ?? { confidence: "low" }) as InferenceSummary,
    createdAt: row.created_at,
  };
}
