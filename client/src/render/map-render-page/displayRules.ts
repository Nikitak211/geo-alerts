/**
 * Map display rules and output label format.
 * See docs/IMPLEMENTATION_NOTES.md for full behavior.
 *
 * Use: Estimated launch region, Approximate launch area, Reverse corridor, Confidence: High/Medium/Low.
 * Avoid: Exact launch site, Confirmed launch point.
 */

import * as Cesium from "cesium";

/** Label for launch region (use this or APPROXIMATE_LAUNCH_AREA_LABEL). */
export const ESTIMATED_LAUNCH_REGION_LABEL = "Estimated launch region";

/** Alternative label for launch area. */
export const APPROXIMATE_LAUNCH_AREA_LABEL = "Approximate launch area";

/** Overlay label for launch region (short form). */
export const LAUNCH_REGION_LABEL = ESTIMATED_LAUNCH_REGION_LABEL;

/** Label for the reverse corridor (when shown in UI). */
export const REVERSE_CORRIDOR_LABEL = "Reverse corridor";

/** Label for confidence row in overlay. */
export const CONFIDENCE_LABEL = "Confidence";

/** Format confidence value for display: High, Medium, Low. */
export function formatConfidenceDisplay(
  level: "high" | "medium" | "low" | string | undefined
): string {
  if (!level) return "—";
  const s = String(level).toLowerCase();
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  if (s === "low") return "Low";
  return level;
}

/** Fallback when data is weak (broad western Iran only). */
export const WEAK_DATA_REGION_FALLBACK = "Western Iran (approximate)";

/** Israel impact markers. */
export const IMPACT_COLOR = Cesium.Color.RED;

/** Impact cluster polygon. */
export const CLUSTER_FILL = Cesium.Color.PURPLE.withAlpha(0.35);
export const CLUSTER_OUTLINE = Cesium.Color.PURPLE;

/** Reverse corridor polygon (blue translucent). */
export const CORRIDOR_FILL = Cesium.Color.BLUE.withAlpha(0.25);
export const CORRIDOR_OUTLINE = Cesium.Color.BLUE;

/** Candidate launch regions (yellow translucent). */
export const CANDIDATE_FILL = Cesium.Color.YELLOW.withAlpha(0.25);
export const CANDIDATE_OUTLINE = Cesium.Color.YELLOW;

/** Best candidate (rank 1) – highlighted stronger. */
export const BEST_CANDIDATE_FILL = Cesium.Color.YELLOW.withAlpha(0.45);
export const BEST_CANDIDATE_OUTLINE = Cesium.Color.YELLOW;
export const BEST_CANDIDATE_OUTLINE_WIDTH = 2.5;

export const DEFAULT_CANDIDATE_OUTLINE_WIDTH = 1.5;
