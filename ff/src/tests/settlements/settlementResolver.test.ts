/**
 * Tests for settlement resolution: one, two, many settlements, unresolved names.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import path from "path";
import { resolveSettlements } from "../../geo/settlements/settlementResolver";

const FIXTURE_PATH = path.join(
  process.cwd(),
  "src",
  "tests",
  "fixtures",
  "municipalities.geojson"
);

describe("settlementResolver", () => {
  describe("one settlement", () => {
    it("resolves a single known settlement", () => {
      const result = resolveSettlements(["SettlementA"], { geojsonPath: FIXTURE_PATH });
      assert.strictEqual(result.matched.length, 1);
      assert.strictEqual(result.unresolved.length, 0);
      assert.strictEqual(result.matched[0].name, "SettlementA");
      assert.strictEqual(typeof result.matched[0].lat, "number");
      assert.strictEqual(typeof result.matched[0].lon, "number");
      assert.strictEqual(result.matched[0].confidence, 1);
    });
  });

  describe("two settlements", () => {
    it("resolves two known settlements", () => {
      const result = resolveSettlements(["SettlementA", "SettlementB"], {
        geojsonPath: FIXTURE_PATH,
      });
      assert.strictEqual(result.matched.length, 2);
      assert.strictEqual(result.unresolved.length, 0);
      const names = result.matched.map((m: { name: string }) => m.name).sort();
      assert.deepStrictEqual(names, ["SettlementA", "SettlementB"]);
    });
  });

  describe("many settlements", () => {
    it("resolves all five fixture settlements", () => {
      const result = resolveSettlements(
        ["SettlementA", "SettlementB", "SettlementC", "SettlementD", "SettlementE"],
        { geojsonPath: FIXTURE_PATH }
      );
      assert.strictEqual(result.matched.length, 5);
      assert.strictEqual(result.unresolved.length, 0);
      const names = result.matched.map((m: { name: string }) => m.name).sort();
      assert.deepStrictEqual(names, [
        "SettlementA",
        "SettlementB",
        "SettlementC",
        "SettlementD",
        "SettlementE",
      ]);
    });
  });

  describe("unresolved settlement names", () => {
    it("returns unresolved names when not in index", () => {
      const result = resolveSettlements(["SettlementA", "NonExistentPlace", "SettlementB"], {
        geojsonPath: FIXTURE_PATH,
      });
      assert.strictEqual(result.matched.length, 2);
      assert.strictEqual(result.unresolved.length, 1);
      assert.strictEqual(result.unresolved[0], "NonExistentPlace");
    });

    it("returns all unresolved when none match", () => {
      const result = resolveSettlements(["Unknown1", "Unknown2"], {
        geojsonPath: FIXTURE_PATH,
      });
      assert.strictEqual(result.matched.length, 0);
      assert.strictEqual(result.unresolved.length, 2);
      assert.ok(result.unresolved.includes("Unknown1"));
      assert.ok(result.unresolved.includes("Unknown2"));
    });
  });

  it("handles empty names list", () => {
    const result = resolveSettlements([], { geojsonPath: FIXTURE_PATH });
    assert.strictEqual(result.matched.length, 0);
    assert.strictEqual(result.unresolved.length, 0);
  });
});
