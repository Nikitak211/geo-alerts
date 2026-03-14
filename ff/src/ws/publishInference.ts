/**
 * On new alert: run inference and broadcast enriched payload over WebSocket.
 */

import type { AlertEvent } from "../domain/alerts/types";
import type { InferenceService } from "../api/inference/inference.service";
import type { RunInferenceResult } from "../geo/inference/runInference";
import { loadIranCandidates } from "../geo/candidates";
import {
  INFERENCE_RESULT,
  type InferenceBroadcastPayload,
  type AlertSummary,
  type TopCandidateSummary,
} from "./alertSocket";

export type BroadcastFn = (data: unknown) => void;

/**
 * Run inference, broadcast inference_result, and return result for persistence.
 */
export async function publishInference(
  alert: AlertEvent,
  inferenceService: InferenceService,
  broadcast: BroadcastFn
): Promise<RunInferenceResult | null> {
  const result = await inferenceService.runInferenceForAlert(alert);
  if (!result) return null;

  const alertSummary: AlertSummary = {
    id: alert.id,
    title: alert.title,
    receivedAt: alert.receivedAt,
    category: alert.category,
    settlementCount: alert.settlements?.length ?? 0,
  };

  const candidates = loadIranCandidates();
  const idToName = new Map(candidates.map((c) => [c.id, c.name]));

  const topCandidates: TopCandidateSummary[] = result.rankedCandidates.map(
    (r, index) => ({
      candidateId: r.candidateId,
      name: idToName.get(r.candidateId) ?? r.candidateId,
      rank: index + 1,
      score: r.score,
      confidence: r.confidence,
    })
  );

  const renderData = inferenceService.buildRenderData(result);
  const payload: InferenceBroadcastPayload = {
    alertSummary,
    cluster: result.cluster,
    corridor: result.corridor,
    topCandidates,
    confidence: result.summary.confidence,
    algorithmVersion: result.algorithmVersion,
    trajectoryPolyline: renderData?.trajectoryPolyline,
    trajectoryTarget: renderData?.trajectoryTarget,
  };

  broadcast({
    type: INFERENCE_RESULT,
    ts: Date.now(),
    payload,
  });

  return result;
}
