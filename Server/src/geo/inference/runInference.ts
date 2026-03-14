/**
 * Orchestrator: run the full server-side inference pipeline from AlertEvent to InferenceResult.
 */

import type {
  AlertEvent,
  InferenceResult,
  SettlementGeoMatch,
} from "../../domain/alerts/types";
import { resolveSettlements } from "../settlements";
import { buildAlertCluster } from "../clustering";
import { buildReverseCorridor } from "./buildReverseCorridor";
import { loadIranCandidates } from "../candidates";
import { rankCandidates } from "./rankCandidates";
import { computeConfidence } from "./confidence";

export const ALGORITHM_VERSION = "1.0.0";

export interface RunInferenceOptions {
  /** Path to municipalities GeoJSON for settlement resolution. */
  geojsonPath?: string;
  /** Path to Iran candidate regions GeoJSON. */
  iranCandidatesPath?: string;
}

export interface InferenceDebug {
  settlementsRequested: number;
  matchedCount: number;
  unresolved: string[];
  algorithmVersion: string;
  hasCluster: boolean;
  candidatesLoaded: number;
  rankedCount: number;
}

export type RunInferenceResult = InferenceResult & { debug?: InferenceDebug };

/**
 * Run the full inference pipeline: resolve settlements → cluster → corridor → load candidates → rank.
 * Handles partial failures; returns low-confidence result if settlements cannot be resolved.
 */
export async function runInference(
  alert: AlertEvent,
  options?: RunInferenceOptions
): Promise<RunInferenceResult> {
  const debug: InferenceDebug = {
    settlementsRequested: 0,
    matchedCount: 0,
    unresolved: [],
    algorithmVersion: ALGORITHM_VERSION,
    hasCluster: false,
    candidatesLoaded: 0,
    rankedCount: 0,
  };

  const names = (alert.settlements ?? [])
    .map((s) => (typeof s?.name === "string" ? s.name.trim() : ""))
    .filter(Boolean);
  debug.settlementsRequested = names.length;

  let matched: SettlementGeoMatch[] = [];
  let unresolved: string[] = [];

  try {
    const resolved = resolveSettlements(names, {
      geojsonPath: options?.geojsonPath,
    });
    matched = resolved.matched;
    unresolved = resolved.unresolved;
    debug.matchedCount = matched.length;
    debug.unresolved = [...unresolved];
  } catch (e) {
    debug.unresolved = [...names];
  }

  const cluster = buildAlertCluster(matched, alert.id);
  debug.hasCluster = matched.length > 0;

  const corridor = buildReverseCorridor(cluster);

  let candidates: Awaited<ReturnType<typeof loadIranCandidates>> = [];
  try {
    candidates = loadIranCandidates({
      dataPath: options?.iranCandidatesPath,
    });
    debug.candidatesLoaded = candidates.length;
  } catch {
    // continue with empty candidates
  }

  const rankedCandidates = rankCandidates(cluster, corridor, candidates);
  debug.rankedCount = rankedCandidates.length;

  const topCandidate = rankedCandidates[0];
  const { level: summaryConfidence, label: confidenceLabel } = computeConfidence({
    settlementsRequested: names.length,
    matchedCount: matched.length,
    unresolvedCount: unresolved.length,
    clusterRadiusKm: cluster.radiusKm,
    topCorridorOverlap: topCandidate?.corridorOverlap,
    topScore: topCandidate?.score,
  });

  /** When confidence is low, show broad western Iran only (never exact launch point). */
  const WEAK_DATA_REGION_FALLBACK = "Western Iran (approximate)";
  const specificRegion = topCandidate?.candidateId
    ? candidates.find((c) => c.id === topCandidate.candidateId)?.name ?? topCandidate.candidateId
    : undefined;
  const estimatedLaunchRegion =
    summaryConfidence === "low" ? WEAK_DATA_REGION_FALLBACK : (specificRegion ?? undefined);

  const result: RunInferenceResult = {
    alertId: alert.id,
    algorithmVersion: ALGORITHM_VERSION,
    cluster,
    corridor,
    rankedCandidates,
    summary: {
      confidence: summaryConfidence,
      estimatedLaunchRegion,
      confidenceLabel,
    },
    debug,
  };

  return result;
}
