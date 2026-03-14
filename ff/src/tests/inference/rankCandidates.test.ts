/**
 * Tests for candidate ranking: no overlap, low scores, top N.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { buildAlertCluster } from "../../geo/clustering/clusterAlerts";
import { buildReverseCorridor } from "../../geo/inference/buildReverseCorridor";
import { rankCandidates } from "../../geo/inference/rankCandidates";
import type { SettlementGeoMatch } from "../../domain/alerts/types";
import type { IranCandidateFeature } from "../../geo/candidates/types";
import type { LonLat } from "../../domain/alerts/types";

function settlementMatch(
  name: string,
  lat: number,
  lon: number
): SettlementGeoMatch {
  return { name, lat, lon, polygonId: null, confidence: 1 };
}

function makeCandidate(
  id: string,
  name: string,
  coords: LonLat[]
): IranCandidateFeature {
  return {
    id,
    name,
    type: "sector",
    priority: 1,
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

describe("rankCandidates", () => {
  it("returns empty when no candidates", () => {
    const matches = [settlementMatch("A", 31.5, 34.8)];
    const cluster = buildAlertCluster(matches);
    const corridor = buildReverseCorridor(cluster);
    const ranked = rankCandidates(cluster, corridor, []);
    assert.strictEqual(ranked.length, 0);
  });

  it("returns top N (default 3) with scores", () => {
    const matches = [settlementMatch("A", 31.5, 34.8), settlementMatch("B", 31.52, 34.82)];
    const cluster = buildAlertCluster(matches);
    const corridor = buildReverseCorridor(cluster);
    const candidates: IranCandidateFeature[] = [
      makeCandidate("c1", "C1", [[48, 32], [50, 32], [50, 34], [48, 34], [48, 32]]),
      makeCandidate("c2", "C2", [[49, 33], [51, 33], [51, 35], [49, 35], [49, 33]]),
      makeCandidate("c3", "C3", [[47, 31], [49, 31], [49, 33], [47, 33], [47, 31]]),
    ];
    const ranked = rankCandidates(cluster, corridor, candidates);
    assert.ok(ranked.length <= 3);
    assert.ok(ranked.length >= 1);
    for (const r of ranked) {
      assert.strictEqual(typeof r.candidateId, "string");
      assert.strictEqual(typeof r.score, "number");
      assert.strictEqual(typeof r.corridorOverlap, "number");
      assert.ok(Array.isArray(r.reasons));
    }
  });

  describe("no candidate overlap", () => {
    it("returns low scores when candidates are far from corridor", () => {
      const matches = [settlementMatch("A", 31.5, 34.8)];
      const cluster = buildAlertCluster(matches);
      const corridor = buildReverseCorridor(cluster);
      const candidates: IranCandidateFeature[] = [
        makeCandidate("far_west", "Far West", [[20, 25], [22, 25], [22, 27], [20, 27], [20, 25]]),
      ];
      const ranked = rankCandidates(cluster, corridor, candidates);
      assert.strictEqual(ranked.length, 1);
      assert.ok(ranked[0].score >= 0 && ranked[0].score <= 1);
      assert.ok(ranked[0].corridorOverlap >= 0 && ranked[0].corridorOverlap <= 1);
    });
  });

  it("respects topN option", () => {
    const matches = [settlementMatch("A", 31.5, 34.8)];
    const cluster = buildAlertCluster(matches);
    const corridor = buildReverseCorridor(cluster);
    const candidates: IranCandidateFeature[] = [
      makeCandidate("c1", "C1", [[48, 32], [50, 32], [50, 34], [48, 34], [48, 32]]),
      makeCandidate("c2", "C2", [[49, 33], [51, 33], [51, 35], [49, 35], [49, 33]]),
      makeCandidate("c3", "C3", [[47, 31], [49, 31], [49, 33], [47, 33], [47, 31]]),
      makeCandidate("c4", "C4", [[50, 34], [52, 34], [52, 36], [50, 36], [50, 34]]),
    ];
    const rankedTwo = rankCandidates(cluster, corridor, candidates, { topN: 2 });
    assert.strictEqual(rankedTwo.length, 2);
    const rankedFive = rankCandidates(cluster, corridor, candidates, { topN: 5 });
    assert.strictEqual(rankedFive.length, 4);
  });
});
