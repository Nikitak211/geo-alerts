/**
 * Tests for full inference pipeline: one/two/many settlements, unresolved, low-confidence fallback.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import path from "path";
import { runInference } from "../../geo/inference/runInference";
import type { AlertEvent } from "../../domain/alerts/types";

const FIXTURE_MUNI = path.join(process.cwd(), "src", "tests", "fixtures", "municipalities.geojson");
const FIXTURE_IRAN = path.join(process.cwd(), "src", "tests", "fixtures", "iran_candidates.geojson");

function alertEvent(id: string, settlementNames: string[]): AlertEvent {
  return {
    id,
    receivedAt: new Date().toISOString(),
    category: "1",
    title: "Test",
    settlements: settlementNames.map((name, i) => ({ name, orderIndex: i })),
    source: "replay",
  };
}

describe("runInference", () => {
  describe("one settlement", () => {
    it("runs pipeline and returns result with cluster and corridor", async () => {
      const alert = alertEvent("alert-1", ["SettlementA"]);
      const result = await runInference(alert, {
        geojsonPath: FIXTURE_MUNI,
        iranCandidatesPath: FIXTURE_IRAN,
      });
      assert.strictEqual(result.alertId, "alert-1");
      assert.ok(result.cluster);
      assert.strictEqual(result.cluster.matchedSettlements.length, 1);
      assert.ok(result.corridor);
      assert.ok(Array.isArray(result.rankedCandidates));
      assert.ok(["high", "medium", "low"].includes(result.summary.confidence));
      assert.strictEqual(typeof result.summary.confidenceLabel, "string");
      assert.ok(result.debug);
      assert.strictEqual(result.debug!.settlementsRequested, 1);
      assert.strictEqual(result.debug!.matchedCount, 1);
      assert.strictEqual(result.debug!.unresolved.length, 0);
    });
  });

  describe("two settlements", () => {
    it("resolves both and builds cluster", async () => {
      const alert = alertEvent("alert-2", ["SettlementA", "SettlementB"]);
      const result = await runInference(alert, {
        geojsonPath: FIXTURE_MUNI,
        iranCandidatesPath: FIXTURE_IRAN,
      });
      assert.strictEqual(result.cluster.matchedSettlements.length, 2);
      assert.strictEqual(result.debug!.unresolved.length, 0);
    });
  });

  describe("many settlements", () => {
    it("resolves all and returns inference", async () => {
      const alert = alertEvent("alert-3", [
        "SettlementA",
        "SettlementB",
        "SettlementC",
        "SettlementD",
        "SettlementE",
      ]);
      const result = await runInference(alert, {
        geojsonPath: FIXTURE_MUNI,
        iranCandidatesPath: FIXTURE_IRAN,
      });
      assert.strictEqual(result.cluster.matchedSettlements.length, 5);
      assert.ok(result.rankedCandidates.length >= 0);
    });
  });

  describe("unresolved settlement names", () => {
    it("returns partial match and lists unresolved", async () => {
      const alert = alertEvent("alert-4", ["SettlementA", "NonExistent", "SettlementB"]);
      const result = await runInference(alert, {
        geojsonPath: FIXTURE_MUNI,
        iranCandidatesPath: FIXTURE_IRAN,
      });
      assert.strictEqual(result.debug!.matchedCount, 2);
      assert.strictEqual(result.debug!.unresolved.length, 1);
      assert.strictEqual(result.debug!.unresolved[0], "NonExistent");
    });
  });

  describe("low-confidence fallback", () => {
    it("returns low confidence when no settlements resolve", async () => {
      const alert = alertEvent("alert-5", ["UnknownPlace1", "UnknownPlace2"]);
      const result = await runInference(alert, {
        geojsonPath: FIXTURE_MUNI,
        iranCandidatesPath: FIXTURE_IRAN,
      });
      assert.strictEqual(result.debug!.matchedCount, 0);
      assert.strictEqual(result.debug!.unresolved.length, 2);
      assert.strictEqual(result.summary.confidence, "low");
      assert.strictEqual(result.cluster.radiusKm, 0);
    });

    it("returns result with human-readable confidence label", async () => {
      const alert = alertEvent("alert-6", ["SettlementA"]);
      const result = await runInference(alert, {
        geojsonPath: FIXTURE_MUNI,
        iranCandidatesPath: FIXTURE_IRAN,
      });
      assert.ok(result.summary.confidenceLabel);
      assert.ok(
        /high|medium|low|resolution|cluster|corridor|fit|uncertainty/i.test(
          result.summary.confidenceLabel
        )
      );
    });
  });

  it("handles empty settlements list", async () => {
    const alert = alertEvent("alert-7", []);
    const result = await runInference(alert, {
      geojsonPath: FIXTURE_MUNI,
      iranCandidatesPath: FIXTURE_IRAN,
    });
    assert.strictEqual(result.debug!.settlementsRequested, 0);
    assert.strictEqual(result.debug!.matchedCount, 0);
    assert.strictEqual(result.summary.confidence, "low");
  });
});
