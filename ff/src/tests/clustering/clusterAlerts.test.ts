/**
 * Tests for impact cluster: one settlement, two, many, compact vs wide spread.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { buildAlertCluster } from "../../geo/clustering/clusterAlerts";
import type { SettlementGeoMatch } from "../../domain/alerts/types";

function settlementMatch(
  name: string,
  lat: number,
  lon: number
): SettlementGeoMatch {
  return { name, lat, lon, polygonId: null, confidence: 1 };
}

describe("clusterAlerts", () => {
  describe("one settlement", () => {
    it("builds point-buffer cluster", () => {
      const matches = [settlementMatch("A", 31.5, 34.8)];
      const cluster = buildAlertCluster(matches, "alert-1");
      assert.strictEqual(cluster.alertId, "alert-1");
      assert.strictEqual(cluster.matchedSettlements.length, 1);
      assert.strictEqual(cluster.centroid[0], 34.8);
      assert.strictEqual(cluster.centroid[1], 31.5);
      assert.ok(cluster.radiusKm > 0);
      assert.ok(Array.isArray(cluster.hull) && cluster.hull.length === 1);
      assert.ok(Array.isArray(cluster.hull[0]) && cluster.hull[0].length > 3);
      assert.strictEqual(cluster.bbox.length, 4);
    });
  });

  describe("two settlements", () => {
    it("builds line-buffer cluster", () => {
      const matches = [
        settlementMatch("A", 31.5, 34.8),
        settlementMatch("B", 31.52, 34.82),
      ];
      const cluster = buildAlertCluster(matches, "alert-2");
      assert.strictEqual(cluster.matchedSettlements.length, 2);
      assert.ok(cluster.radiusKm > 0);
      assert.ok(Array.isArray(cluster.hull) && cluster.hull[0].length >= 4);
      const [minLon, minLat, maxLon, maxLat] = cluster.bbox;
      assert.ok(maxLon > minLon && maxLat > minLat);
    });
  });

  describe("many settlements", () => {
    it("builds convex hull cluster", () => {
      const matches = [
        settlementMatch("A", 31.5, 34.8),
        settlementMatch("B", 31.52, 34.82),
        settlementMatch("C", 31.49, 34.79),
        settlementMatch("D", 31.51, 34.81),
      ];
      const cluster = buildAlertCluster(matches, "alert-3");
      assert.strictEqual(cluster.matchedSettlements.length, 4);
      assert.ok(cluster.hull && cluster.hull[0].length >= 3);
      assert.ok(cluster.radiusKm > 0);
    });
  });

  describe("compact cluster", () => {
    it("produces small radius when points are close", () => {
      const matches = [
        settlementMatch("A", 31.5, 34.8),
        settlementMatch("B", 31.5001, 34.8001),
        settlementMatch("C", 31.4999, 34.7999),
      ];
      const cluster = buildAlertCluster(matches);
      assert.ok(cluster.radiusKm < 5);
    });
  });

  describe("very wide spread cluster", () => {
    it("produces large radius when points are far apart", () => {
      const matches = [
        settlementMatch("North", 33, 35),
        settlementMatch("South", 30, 35),
      ];
      const cluster = buildAlertCluster(matches);
      assert.ok(cluster.radiusKm > 100);
    });
  });

  describe("zero settlements", () => {
    it("returns degenerate cluster", () => {
      const cluster = buildAlertCluster([]);
      assert.strictEqual(cluster.centroid[0], 0);
      assert.strictEqual(cluster.centroid[1], 0);
      assert.strictEqual(cluster.radiusKm, 0);
      assert.strictEqual(cluster.hull, null);
      assert.deepStrictEqual(cluster.bbox, [0, 0, 0, 0]);
      assert.strictEqual(cluster.matchedSettlements.length, 0);
    });
  });
});
