/**
 * Replay a single saved alert through the current inference pipeline and compare with stored result.
 */

import * as fs from "fs";
import * as path from "path";
import type { Pool } from "pg";
import { getAlertById } from "../storage/repositories/alertRepository";
import { getInferenceByAlertId } from "../storage/repositories/inferenceRepository";
import { mapNormalizedToAlertEvent } from "../domain/alerts/mappers";
import { runInference, type RunInferenceOptions } from "../geo/inference/runInference";
import type { AlertEvent } from "../domain/alerts/types";
import type { RunInferenceResult } from "../geo/inference/runInference";
import type { PersistInferenceRow } from "../storage/repositories/inferenceRepository";
import type { RawOrefPayload } from "../ingest/oref/types";

export interface ReplayAlertOptions extends RunInferenceOptions {
  /** DB pool to load alert and old inference. */
  pool: Pool;
  /** If set, write comparison and optionally new inference to this directory. */
  saveArtifacts?: boolean | string;
}

export interface ReplayComparison {
  alertId: string;
  hasOldInference: boolean;
  algorithmVersion: { old: string | null; new: string };
  confidence: { old: "high" | "medium" | "low" | null; new: "high" | "medium" | "low" };
  estimatedLaunchRegion: { old: string | null; new: string | undefined };
  topCandidateIds: { old: string[]; new: string[] };
  topCandidatesMatch: boolean;
  clusterCentroidDelta?: { lon: number; lat: number };
  corridorBearingDelta?: number;
}

export interface ReplayAlertResult {
  alertId: string;
  alert: AlertEvent;
  oldInference: (PersistInferenceRow & { id: number; createdAt: string }) | null;
  newInference: RunInferenceResult;
  comparison: ReplayComparison;
  artifactsPath?: string;
}

/**
 * Load a saved alert, run current inference, compare with stored result.
 * Optionally save comparison and new inference to disk.
 */
export async function replayAlert(
  alertId: string,
  options: ReplayAlertOptions
): Promise<ReplayAlertResult | null> {
  const { pool, saveArtifacts, ...inferenceOptions } = options;

  const row = await getAlertById(pool, alertId);
  if (!row) return null;

  const alert: AlertEvent = {
    ...mapNormalizedToAlertEvent(
      row.normalizedAlert,
      row.rawPayload as RawOrefPayload,
      { receivedAt: row.receivedAt ?? new Date().toISOString() }
    ),
    source: "replay",
  };

  const oldInference = await getInferenceByAlertId(pool, alertId);
  const newInference = await runInference(alert, inferenceOptions);

  const comparison = compareInference(oldInference, newInference);

  let artifactsPath: string | undefined;
  if (saveArtifacts) {
    const dir = typeof saveArtifacts === "string" ? saveArtifacts : path.join(process.cwd(), "replay-artifacts");
    await fs.promises.mkdir(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const base = `replay-${alertId}-${ts}`;
    const comparisonPath = path.join(dir, `${base}-comparison.json`);
    await fs.promises.writeFile(
      comparisonPath,
      JSON.stringify({ alertId, comparison, oldInference: oldInference ? serializeOld(oldInference) : null, newInference: serializeNew(newInference) }, null, 2),
      "utf8"
    );
    artifactsPath = comparisonPath;
  }

  return {
    alertId,
    alert,
    oldInference,
    newInference,
    comparison,
    artifactsPath,
  };
}

function compareInference(
  oldRow: (PersistInferenceRow & { id: number; createdAt: string }) | null,
  newResult: RunInferenceResult
): ReplayComparison {
  const oldTopIds = oldRow?.rankedCandidates?.slice(0, 3).map((c) => c.candidateId) ?? [];
  const newTopIds = newResult.rankedCandidates.slice(0, 3).map((c) => c.candidateId);
  const topCandidatesMatch =
    oldTopIds.length === newTopIds.length &&
    oldTopIds.every((id, i) => id === newTopIds[i]);

  let clusterCentroidDelta: { lon: number; lat: number } | undefined;
  let corridorBearingDelta: number | undefined;
  if (oldRow) {
    const [oldLon, oldLat] = oldRow.cluster.centroid;
    const [newLon, newLat] = newResult.cluster.centroid;
    clusterCentroidDelta = { lon: newLon - oldLon, lat: newLat - oldLat };
    corridorBearingDelta = Math.abs(newResult.corridor.centerBearingDeg - oldRow.corridor.centerBearingDeg);
  }

  return {
    alertId: newResult.alertId,
    hasOldInference: oldRow != null,
    algorithmVersion: { old: oldRow?.algorithmVersion ?? null, new: newResult.algorithmVersion },
    confidence: { old: oldRow?.summary?.confidence ?? null, new: newResult.summary.confidence },
    estimatedLaunchRegion: {
      old: oldRow?.summary?.estimatedLaunchRegion ?? null,
      new: newResult.summary.estimatedLaunchRegion,
    },
    topCandidateIds: { old: oldTopIds, new: newTopIds },
    topCandidatesMatch,
    clusterCentroidDelta,
    corridorBearingDelta,
  };
}

function serializeOld(
  row: PersistInferenceRow & { id: number; createdAt: string }
): Record<string, unknown> {
  return {
    id: row.id,
    alertId: row.alertId,
    algorithmVersion: row.algorithmVersion,
    summary: row.summary,
    rankedCandidateIds: row.rankedCandidates.map((c) => c.candidateId),
    createdAt: row.createdAt,
  };
}

function serializeNew(result: RunInferenceResult): Record<string, unknown> {
  return {
    alertId: result.alertId,
    algorithmVersion: result.algorithmVersion,
    summary: result.summary,
    rankedCandidateIds: result.rankedCandidates.map((c) => c.candidateId),
  };
}
