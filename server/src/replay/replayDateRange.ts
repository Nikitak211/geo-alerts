/**
 * Replay all saved alerts in a date range through the current inference pipeline.
 */

import * as fs from "fs";
import * as path from "path";
import type { Pool } from "pg";
import { listAlertsByDateRange } from "../storage/repositories/alertRepository";
import { replayAlert, type ReplayAlertResult } from "./replayAlert";
import type { RunInferenceOptions } from "../geo/inference/runInference";

export interface ReplayDateRangeOptions extends RunInferenceOptions {
  pool: Pool;
  /** Inclusive start (ISO date or datetime). */
  from: string;
  /** Inclusive end (ISO date or datetime). */
  to: string;
  /** If set, save per-alert comparison artifacts and a summary to this directory. */
  saveArtifacts?: boolean | string;
}

export interface ReplayDateRangeSummary {
  from: string;
  to: string;
  alertsTotal: number;
  alertsProcessed: number;
  alertsSkipped: number;
  withOldInference: number;
  topCandidatesMatchCount: number;
  confidenceChanged: number;
  algorithmVersionOld: Record<string, number>;
  algorithmVersionNew: string;
  perAlert: Array<{
    alertId: string;
    hasOldInference: boolean;
    topCandidatesMatch: boolean;
    confidenceOld: string | null;
    confidenceNew: string;
  }>;
}

export interface ReplayDateRangeResult {
  summary: ReplayDateRangeSummary;
  results: ReplayAlertResult[];
  artifactsDir?: string;
}

/**
 * List alerts in [from, to], run each through current inference, compare with stored results.
 * Optionally save per-alert artifacts and a summary JSON.
 */
export async function replayDateRange(
  options: ReplayDateRangeOptions
): Promise<ReplayDateRangeResult> {
  const { pool, from, to, saveArtifacts, ...inferenceOptions } = options;

  const list = await listAlertsByDateRange(pool, from, to);
  const results: ReplayAlertResult[] = [];
  const dir = typeof saveArtifacts === "string" ? saveArtifacts : saveArtifacts ? path.join(process.cwd(), "replay-artifacts") : undefined;
  if (dir && saveArtifacts) {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  for (const item of list) {
    const one = await replayAlert(item.id, {
      pool,
      saveArtifacts: dir ? dir : false,
      ...inferenceOptions,
    });
    if (one) results.push(one);
  }

  const summary = buildSummary(from, to, list, results);
  let artifactsDir: string | undefined;
  if (dir && saveArtifacts) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const summaryPath = path.join(dir, `replay-summary-${from.slice(0, 10)}-${to.slice(0, 10)}-${ts}.json`);
    await fs.promises.writeFile(
      summaryPath,
      JSON.stringify({ summary, alertIds: results.map((r) => r.alertId) }, null, 2),
      "utf8"
    );
    artifactsDir = dir;
  }

  return { summary, results, artifactsDir };
}

function buildSummary(
  from: string,
  to: string,
  list: Array<{ id: string; receivedAt: string }>,
  results: ReplayAlertResult[]
): ReplayDateRangeSummary {
  const withOldInference = results.filter((r) => r.comparison.hasOldInference).length;
  const topCandidatesMatchCount = results.filter((r) => r.comparison.topCandidatesMatch).length;
  const confidenceChanged = results.filter(
    (r) => r.oldInference && r.oldInference.summary.confidence !== r.newInference.summary.confidence
  ).length;

  const algorithmVersionOld: Record<string, number> = {};
  let algorithmVersionNew = "";
  for (const r of results) {
    if (r.oldInference) {
      const v = r.oldInference.algorithmVersion;
      algorithmVersionOld[v] = (algorithmVersionOld[v] ?? 0) + 1;
    }
    if (r.newInference) algorithmVersionNew = r.newInference.algorithmVersion;
  }

  const perAlert = results.map((r) => ({
    alertId: r.alertId,
    hasOldInference: r.comparison.hasOldInference,
    topCandidatesMatch: r.comparison.topCandidatesMatch,
    confidenceOld: r.comparison.confidence.old,
    confidenceNew: r.comparison.confidence.new,
  }));

  return {
    from,
    to,
    alertsTotal: list.length,
    alertsProcessed: results.length,
    alertsSkipped: list.length - results.length,
    withOldInference,
    topCandidatesMatchCount,
    confidenceChanged,
    algorithmVersionOld,
    algorithmVersionNew,
    perAlert,
  };
}
