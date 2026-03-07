/**
 * Tests for reverse corridor: compact cluster, wide cluster, missing hull fallback, one-settlement cluster.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { buildAlertCluster } from "../../geo/clustering/clusterAlerts";
import {
  buildReverseCorridor,
  halfSpreadDegFromCluster,
} from "../../geo/inference/buildReverseCorridor";
import type { AlertCluster, SettlementGeoMatch } from "../../domain/alerts/types";

function settlementMatch(
  name: string,
  lat: number,
  lon: number
): SettlementGeoMatch {
  return { name, lat, lon, polygonId: null, confidence: 1 };
}

describe("buildReverseCorridor", () => {
  describe("compact cluster", () => {
    it("builds corridor with start at centroid and polygon ring", () => {
      const matches = [
        settlementMatch("A", 31.5, 34.8),
        settlementMatch("B", 31.5001, 34.8001),
      ];
      const cluster = buildAlertCluster(matches);
      const corridor = buildReverseCorridor(cluster);
      assert.strictEqual(corridor.startPoint[0], cluster.centroid[0]);
      assert.strictEqual(corridor.startPoint[1], cluster.centroid[1]);
      assert.ok(Array.isArray(corridor.polygon) && corridor.polygon.length === 1);
      assert.ok(corridor.polygon[0].length >= 4);
      assert.strictEqual(typeof corridor.centerBearingDeg, "number");
      assert.ok(corridor.centerBearingDeg >= 60 && corridor.centerBearingDeg <= 100);
      assert.strictEqual(typeof corridor.spreadDeg, "number");
      assert.ok(corridor.maxDistanceKm > 0);
      assert.deepStrictEqual(
        Object.keys(corridor).sort(),
        ["centerBearingDeg", "endPoint", "maxDistanceKm", "polygon", "spreadDeg", "startPoint"]
      );
    });
  });

  describe("wide cluster", () => {
    it("builds corridor with wider spread when cluster is large", () => {
      const matches = [
        settlementMatch("North", 33, 35),
        settlementMatch("South", 30, 35),
      ];
      const cluster = buildAlertCluster(matches);
      const corridor = buildReverseCorridor(cluster);
      assert.ok(corridor.spreadDeg >= 4);
      assert.ok(corridor.polygon[0].length >= 4);
      const [start] = corridor.polygon[0];
      assert.strictEqual(start[0], corridor.startPoint[0]);
      assert.strictEqual(start[1], corridor.startPoint[1]);
    });
  });

  describe("missing hull fallback", () => {
    it("builds corridor from centroid and bbox/radiusKm when hull is null", () => {
      const cluster: AlertCluster = {
        alertId: "test",
        centroid: [34.8, 31.5],
        bbox: [34.79, 31.49, 34.81, 31.51],
        hull: null,
        radiusKm: 5,
        matchedSettlements: [settlementMatch("A", 31.5, 34.8)],
      };
      const corridor = buildReverseCorridor(cluster);
      assert.strictEqual(corridor.startPoint[0], 34.8);
      assert.strictEqual(corridor.startPoint[1], 31.5);
      assert.ok(corridor.polygon.length === 1 && corridor.polygon[0].length >= 4);
      assert.ok(corridor.spreadDeg >= 4 && corridor.spreadDeg <= 50);
      assert.ok(
        corridor.maxDistanceKm >= 800 && corridor.maxDistanceKm <= 1500,
        "maxDistanceKm is computed from cluster to western Iran reference"
      );
    });
  });

  describe("one-settlement cluster", () => {
    it("builds narrower corridor from single-settlement point buffer", () => {
      const matches = [settlementMatch("A", 31.5, 34.8)];
      const cluster = buildAlertCluster(matches);
      const corridor = buildReverseCorridor(cluster);
      assert.strictEqual(cluster.matchedSettlements.length, 1);
      assert.strictEqual(corridor.startPoint[0], cluster.centroid[0]);
      assert.strictEqual(corridor.startPoint[1], cluster.centroid[1]);
      assert.ok(corridor.polygon[0].length === 4);
      assert.ok(corridor.spreadDeg >= 4 && corridor.spreadDeg <= 25);
    });
  });

  it("accepts options to override defaults", () => {
    const matches = [settlementMatch("A", 31.5, 34.8)];
    const cluster = buildAlertCluster(matches);
    const corridor = buildReverseCorridor(cluster, {
      maxDistanceKm: 500,
      minBearingDeg: 70,
      maxBearingDeg: 90,
    });
    assert.strictEqual(corridor.maxDistanceKm, 500);
    assert.ok(corridor.centerBearingDeg >= 70 && corridor.centerBearingDeg <= 90);
  });
});

describe("halfSpreadDegFromCluster", () => {
  it("returns larger half-spread for wider cluster (radiusKm)", () => {
    const narrow: AlertCluster = {
      alertId: "n",
      centroid: [34.8, 31.5],
      bbox: [34.79, 31.49, 34.81, 31.51],
      hull: null,
      radiusKm: 2,
      matchedSettlements: [],
    };
    const wide: AlertCluster = {
      ...narrow,
      alertId: "w",
      radiusKm: 100,
      bbox: [34, 30, 35, 33],
    };
    const opts = {
      minBearingDeg: 60,
      maxBearingDeg: 100,
      spreadDeg: 8,
      maxDistanceKm: 1200,
      minSpreadDeg: 4,
      maxSpreadDeg: 25,
      spreadPerRadiusKm: 0.5,
    };
    const halfNarrow = halfSpreadDegFromCluster(narrow, opts);
    const halfWide = halfSpreadDegFromCluster(wide, opts);
    assert.ok(halfWide > halfNarrow);
  });
});
