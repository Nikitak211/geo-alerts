/**
 * Standardized confidence bands for inference results.
 * Every inference result has a human-readable confidence label: high | medium | low.
 *
 * Rules:
 * - high: good settlement resolution + tight cluster + strong corridor overlap
 * - medium: partial uncertainty
 * - low: poor resolution or weak directional fit
 */

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceInputs {
  /** Number of settlements requested in the alert. */
  settlementsRequested: number;
  /** Number of settlements resolved to coordinates. */
  matchedCount: number;
  /** Number of settlements that could not be resolved. */
  unresolvedCount: number;
  /** Cluster radius in km (smaller = tighter). */
  clusterRadiusKm: number;
  /** Top-ranked candidate's corridor overlap (0–1). Undefined if no candidates. */
  topCorridorOverlap?: number;
  /** Top-ranked candidate's score (0–1). Undefined if no candidates. */
  topScore?: number;
}

/** Human-readable label for each level. */
export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "High — good settlement resolution, tight cluster, strong corridor fit",
  medium: "Medium — partial uncertainty in resolution or directional fit",
  low: "Low — poor resolution or weak directional fit",
};

/** Default thresholds (tunable). */
const THRESHOLDS = {
  /** Resolution: ratio of matched to requested above this → good resolution. */
  resolutionRatioGood: 0.9,
  /** No unresolved names → good resolution. */
  unresolvedGood: 0,
  /** Cluster radius below this (km) → tight cluster. */
  clusterTightKm: 25,
  /** Cluster radius below this (km) → acceptable for high if rest is strong. */
  clusterAcceptableKm: 40,
  /** Top candidate corridor overlap above this → strong fit. */
  corridorOverlapStrong: 0.5,
  /** Top candidate overlap above this → acceptable. */
  corridorOverlapAcceptable: 0.25,
  /** Minimum matched settlements to consider anything above low. */
  minMatchedForMedium: 1,
  /** Minimum matched for high (with good resolution). */
  minMatchedForHigh: 2,
};

/**
 * Compute confidence level and human-readable label from inference inputs.
 */
export function computeConfidence(inputs: ConfidenceInputs): {
  level: ConfidenceLevel;
  label: string;
} {
  const level = computeConfidenceLevel(inputs);
  return {
    level,
    label: CONFIDENCE_LABELS[level],
  };
}

/**
 * Compute confidence level only.
 */
export function computeConfidenceLevel(inputs: ConfidenceInputs): ConfidenceLevel {
  const {
    settlementsRequested,
    matchedCount,
    unresolvedCount,
    clusterRadiusKm,
    topCorridorOverlap = 0,
    topScore = 0,
  } = inputs;

  const hasRequested = settlementsRequested > 0;
  const resolutionRatio = hasRequested ? matchedCount / settlementsRequested : 0;
  const goodResolution =
    unresolvedCount <= THRESHOLDS.unresolvedGood &&
    resolutionRatio >= THRESHOLDS.resolutionRatioGood;
  const anyResolution = matchedCount >= THRESHOLDS.minMatchedForMedium;

  const tightCluster = clusterRadiusKm <= THRESHOLDS.clusterTightKm;
  const acceptableCluster = clusterRadiusKm <= THRESHOLDS.clusterAcceptableKm;

  const strongOverlap = (topCorridorOverlap ?? 0) >= THRESHOLDS.corridorOverlapStrong;
  const acceptableOverlap =
    (topCorridorOverlap ?? 0) >= THRESHOLDS.corridorOverlapAcceptable ||
    (topScore ?? 0) >= THRESHOLDS.corridorOverlapAcceptable;

  // Low: poor resolution or no directional fit
  if (!anyResolution) return "low";
  if (!acceptableOverlap && matchedCount < THRESHOLDS.minMatchedForHigh) return "low";
  if (unresolvedCount > 0 && matchedCount < THRESHOLDS.minMatchedForHigh) return "low";

  // High: good resolution + tight cluster + strong corridor overlap
  if (
    matchedCount >= THRESHOLDS.minMatchedForHigh &&
    goodResolution &&
    tightCluster &&
    strongOverlap
  ) {
    return "high";
  }

  // High with slightly looser cluster if resolution and overlap are strong
  if (
    matchedCount >= THRESHOLDS.minMatchedForHigh &&
    goodResolution &&
    acceptableCluster &&
    strongOverlap
  ) {
    return "high";
  }

  // Medium: partial uncertainty
  if (anyResolution && (acceptableOverlap || acceptableCluster)) return "medium";
  if (matchedCount >= THRESHOLDS.minMatchedForHigh && goodResolution) return "medium";

  return "low";
}
