/**
 * Rank Iran candidate regions by corridor fit and distance; return top N.
 */

import type { AlertCluster, CandidateScore, ReverseCorridor } from "../../domain/alerts/types";
import type { IranCandidateFeature } from "../candidates/types";
import { scoreCandidate } from "./scoreCandidate";

const DEFAULT_TOP_N = 3;

export interface RankCandidatesOptions {
  /** Max number of candidates to return. Default 3. */
  topN?: number;
}

/**
 * Score and rank candidates by fit to the reverse corridor. Returns top N
 * (default 3) as broad region estimates, not exact launch sites.
 */
export function rankCandidates(
  cluster: AlertCluster,
  corridor: ReverseCorridor,
  candidates: IranCandidateFeature[],
  options?: RankCandidatesOptions
): CandidateScore[] {
  const topN = options?.topN ?? DEFAULT_TOP_N;
  if (candidates.length === 0) return [];

  const scored = candidates.map((c) => scoreCandidate(cluster, corridor, c));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
