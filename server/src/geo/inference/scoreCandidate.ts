/**
 * Score one Iran candidate by corridor fit, distance, bearing, and cluster confidence.
 */

import type {
  AlertCluster,
  CandidateLaunchArea,
  CandidateScore,
  LonLat,
  ReverseCorridor,
} from "../../domain/alerts/types";
import type { IranCandidateFeature } from "../candidates/types";
import { bearingBetween, distanceKm, pointInPolygon, centroidOfRing } from "./math";

function getCandidateRings(c: CandidateLaunchArea): LonLat[][] {
  if (c.geometry.type === "Polygon") {
    return c.geometry.coordinates.map((ring) => ring as LonLat[]);
  }
  const rings: LonLat[][] = [];
  for (const poly of c.geometry.coordinates) {
    if (poly?.[0]?.length) rings.push(poly[0] as LonLat[]);
  }
  return rings;
}

function getCandidateCentroid(c: CandidateLaunchArea): LonLat {
  const rings = getCandidateRings(c);
  if (rings.length === 0) return [0, 0];
  return centroidOfRing(rings[0]);
}

/**
 * Overlap heuristic: 0–1 from centroid and vertex containment in corridor.
 */
function corridorOverlapRatio(
  corridorRing: LonLat[],
  candidate: CandidateLaunchArea
): number {
  const rings = getCandidateRings(candidate);
  if (rings.length === 0) return 0;
  const outer = rings[0];
  const centroidIn = pointInPolygon(getCandidateCentroid(candidate), corridorRing);
  let verticesInside = 0;
  for (const p of outer) {
    if (pointInPolygon(p, corridorRing)) verticesInside++;
  }
  const total = outer.length;
  if (total === 0) return centroidIn ? 1 : 0;
  const vertexRatio = verticesInside / total;
  return centroidIn ? 0.5 + 0.5 * vertexRatio : 0.5 * vertexRatio;
}

/**
 * Normalize bearing difference to 0–180.
 */
function bearingDeltaDeg(corridorBearing: number, fromBearing: number): number {
  let d = Math.abs(fromBearing - corridorBearing);
  if (d > 180) d = 360 - d;
  return d;
}

const DISTANCE_PENALTY_THRESHOLD_KM = 1200;
const DISTANCE_PENALTY_PER_200KM = 0.08;
const MAX_DISTANCE_PENALTY = 0.4;
const CLUSTER_RADIUS_CONFIDENCE_CAP_KM = 60;

/**
 * Score one candidate. Higher score = better fit.
 */
export function scoreCandidate(
  cluster: AlertCluster,
  corridor: ReverseCorridor,
  candidate: IranCandidateFeature
): CandidateScore {
  const reasons: string[] = [];
  const start = cluster.centroid;
  const candidateCentroid = getCandidateCentroid(candidate);

  const distanceKmVal = distanceKm(start, candidateCentroid);
  const bearingToCandidate = bearingBetween(start, candidateCentroid);
  const delta = bearingDeltaDeg(corridor.centerBearingDeg, bearingToCandidate);
  const corridorRing = corridor.polygon[0] ?? [];
  const overlap = corridorRing.length >= 3
    ? corridorOverlapRatio(corridorRing, candidate)
    : 0;

  if (overlap > 0.5) reasons.push("high corridor overlap");
  else if (overlap > 0) reasons.push("partial corridor overlap");
  else reasons.push("no corridor overlap");

  if (delta < 15) reasons.push("bearing aligned with corridor");
  else if (delta < 45) reasons.push("moderate bearing offset");
  else reasons.push("large bearing offset");

  if (distanceKmVal < 800) reasons.push("within typical range");
  else if (distanceKmVal > DISTANCE_PENALTY_THRESHOLD_KM) {
    const over = distanceKmVal - DISTANCE_PENALTY_THRESHOLD_KM;
    reasons.push("excessively distant");
  }

  const priority = candidate.priority ?? 999;
  const typeWeight = 1 / Math.max(1, priority);

  let confidence = 1;
  if (cluster.radiusKm > CLUSTER_RADIUS_CONFIDENCE_CAP_KM) {
    confidence = Math.max(0.3, 1 - (cluster.radiusKm - CLUSTER_RADIUS_CONFIDENCE_CAP_KM) / 100);
    reasons.push("cluster uncertainty reduces confidence");
  }
  if (cluster.matchedSettlements.length < 3) {
    confidence *= 0.85;
    reasons.push("few settlements in cluster");
  }

  const overlapComponent = overlap * 0.4;
  const bearingComponent = (1 - Math.min(delta, 180) / 180) * 0.35;
  const typeComponent = Math.min(1, typeWeight * 4) * 0.15;
  let baseScore = overlapComponent + bearingComponent + typeComponent;

  let distancePenalty = 0;
  if (distanceKmVal > DISTANCE_PENALTY_THRESHOLD_KM) {
    distancePenalty = Math.min(
      MAX_DISTANCE_PENALTY,
      ((distanceKmVal - DISTANCE_PENALTY_THRESHOLD_KM) / 200) * DISTANCE_PENALTY_PER_200KM
    );
  }
  baseScore = Math.max(0, baseScore - distancePenalty);
  const score = Math.min(1, baseScore * confidence);

  return {
    candidateId: candidate.id,
    score,
    distanceKm: distanceKmVal,
    bearingDelta: delta,
    corridorOverlap: overlap,
    confidence,
    reasons,
  };
}
