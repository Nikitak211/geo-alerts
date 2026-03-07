/**
 * Inference: reverse launch corridor, candidate scoring, ranking, and orchestrator.
 */

export { buildReverseCorridor, halfSpreadDegFromCluster } from "./buildReverseCorridor";
export type { ReverseCorridorOptions } from "./buildReverseCorridor";
export { scoreCandidate } from "./scoreCandidate";
export { rankCandidates } from "./rankCandidates";
export type { RankCandidatesOptions } from "./rankCandidates";
export { runInference, ALGORITHM_VERSION } from "./runInference";
export type { RunInferenceOptions, RunInferenceResult, InferenceDebug } from "./runInference";
export { computeConfidence, computeConfidenceLevel, CONFIDENCE_LABELS } from "./confidence";
export type { ConfidenceLevel, ConfidenceInputs } from "./confidence";
export {
  destinationPoint,
  normalizeBearingDeg,
  bearingBetween,
  distanceKm,
  pointInPolygon,
  ringArea,
  centroidOfRing,
  EARTH_RADIUS_KM,
} from "./math";
