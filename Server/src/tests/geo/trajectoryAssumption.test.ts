/**
 * TDD (RED first): trajectory algorithm unification tests.
 * Client canonical: Lebanon-first (30–400 km), Iran crossing, FALLBACK_EXTEND_KM=2500.
 * Server must match this behavior.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  computeTrajectoryAssumption,
  orientBearingEast,
} from "../../geo/trajectoryAssumption";
import { distanceKm } from "../../geo/inference/math";
import type { LonLat } from "../../domain/alerts/types";

/** 10 positions arranged east-west around a center; yields principal bearing ≈ 90° (east). */
function eastWestPositions(center: LonLat, count = 10): LonLat[] {
  const positions: LonLat[] = [];
  for (let i = 0; i < count; i++) {
    const offset = (i - count / 2) * 0.05;
    positions.push([center[0] + offset, center[1]]);
  }
  return positions;
}

/** 10 positions arranged north-south; principal bearing ≈ 0° or 180°. */
function northSouthPositions(center: LonLat, count = 10): LonLat[] {
  const positions: LonLat[] = [];
  for (let i = 0; i < count; i++) {
    const offset = (i - count / 2) * 0.05;
    positions.push([center[0], center[1] + offset]);
  }
  return positions;
}

const CENTER: LonLat = [34.8, 32.1]; // roughly Tel Aviv

describe("orientBearingEast", () => {
  it("returns bearing unchanged when already pointing east", () => {
    assert.strictEqual(orientBearingEast(90), 90);
  });

  it("returns opposite when bearing points west", () => {
    assert.strictEqual(orientBearingEast(270), 90);
  });

  it("returns northeast bearing when northeast vs southwest", () => {
    assert.strictEqual(orientBearingEast(45), 45);
  });

  it("returns southeast bearing when southeast vs northwest", () => {
    assert.strictEqual(orientBearingEast(135), 135);
  });

  it("returns 90 on tie (north/south equidistant from east)", () => {
    assert.strictEqual(orientBearingEast(0), 90);
    assert.strictEqual(orientBearingEast(180), 90);
  });
});

describe("computeTrajectoryAssumption — MIN_POSITIONS guard", () => {
  it("returns null when fewer than 10 positions", () => {
    const positions = eastWestPositions(CENTER, 9);
    const result = computeTrajectoryAssumption(CENTER, positions, 0, []);
    assert.strictEqual(result, null);
  });

  it("returns a result with exactly 10 positions", () => {
    const positions = eastWestPositions(CENTER, 10);
    const result = computeTrajectoryAssumption(CENTER, positions, 0, []);
    assert.notStrictEqual(result, null);
  });
});

describe("computeTrajectoryAssumption — FALLBACK_EXTEND_KM = 2500", () => {
  it("extends fallback end point ~2500 km when both boundary finders return null", () => {
    const positions = eastWestPositions(CENTER, 10);
    const result = computeTrajectoryAssumption(CENTER, positions, 0, [], {
      findLebanonCrossing: () => null,
      findIranCrossing: () => null,
    });
    assert.notStrictEqual(result, null);
    const dist = distanceKm(CENTER, result!.endPoint);
    // Allow ±50 km tolerance on great-circle fallback
    assert.ok(
      dist >= 2450 && dist <= 2550,
      `Expected endPoint ~2500 km from center, got ${dist.toFixed(0)} km`
    );
  });

  it("sets source to 'fallback' when no boundary hit", () => {
    const positions = eastWestPositions(CENTER, 10);
    const result = computeTrajectoryAssumption(CENTER, positions, 0, [], {
      findLebanonCrossing: () => null,
      findIranCrossing: () => null,
    });
    assert.strictEqual(result!.source, "fallback");
  });
});

describe("computeTrajectoryAssumption — Lebanon first", () => {
  it("uses Lebanon crossing when finder returns a point", () => {
    const positions = northSouthPositions(CENTER, 10);
    const mockLebanon: LonLat = [35.5, 33.5]; // north of Israel

    const result = computeTrajectoryAssumption(CENTER, positions, 0, [], {
      findLebanonCrossing: () => mockLebanon,
      findIranCrossing: () => null,
    });

    assert.notStrictEqual(result, null);
    assert.strictEqual(result!.source, "lebanon");
    assert.deepStrictEqual(result!.endPoint, mockLebanon);
  });

  it("polyline starts at center and ends at Lebanon crossing", () => {
    const positions = northSouthPositions(CENTER, 10);
    const mockLebanon: LonLat = [35.5, 33.5];

    const result = computeTrajectoryAssumption(CENTER, positions, 0, [], {
      findLebanonCrossing: () => mockLebanon,
      findIranCrossing: () => null,
    });

    const poly = result!.polyline;
    assert.deepStrictEqual(poly[0], CENTER);
    assert.deepStrictEqual(poly[poly.length - 1], mockLebanon);
    assert.ok(poly.length === 17, `Expected 17 polyline points, got ${poly.length}`);
  });
});

describe("computeTrajectoryAssumption — Iran crossing", () => {
  it("uses Iran crossing when Lebanon returns null", () => {
    const positions = eastWestPositions(CENTER, 10);
    const mockIran: LonLat = [53.0, 32.5];

    const result = computeTrajectoryAssumption(CENTER, positions, 0, [], {
      findLebanonCrossing: () => null,
      findIranCrossing: () => mockIran,
    });

    assert.notStrictEqual(result, null);
    assert.strictEqual(result!.source, "iran");
    assert.deepStrictEqual(result!.endPoint, mockIran);
  });

  it("Lebanon takes priority over Iran when both return a crossing", () => {
    const positions = eastWestPositions(CENTER, 10);
    const mockLebanon: LonLat = [35.5, 33.5];
    const mockIran: LonLat = [53.0, 32.5];

    const result = computeTrajectoryAssumption(CENTER, positions, 0, [], {
      findLebanonCrossing: () => mockLebanon,
      findIranCrossing: () => mockIran,
    });

    assert.strictEqual(result!.source, "lebanon");
    assert.deepStrictEqual(result!.endPoint, mockLebanon);
  });
});

describe("computeTrajectoryAssumption — polyline integrity", () => {
  it("polyline always has 17 points (POLYLINE_SEGMENTS=16 + endpoint)", () => {
    const positions = eastWestPositions(CENTER, 10);
    const result = computeTrajectoryAssumption(CENTER, positions, 0, [], {
      findLebanonCrossing: () => null,
      findIranCrossing: () => null,
    });
    assert.strictEqual(result!.polyline.length, 17);
  });

  it("polyline first point equals center", () => {
    const positions = eastWestPositions(CENTER, 10);
    const result = computeTrajectoryAssumption(CENTER, positions, 0, [], {
      findLebanonCrossing: () => null,
      findIranCrossing: () => null,
    });
    assert.deepStrictEqual(result!.polyline[0], CENTER);
  });

  it("polyline last point equals endPoint", () => {
    const positions = eastWestPositions(CENTER, 10);
    const result = computeTrajectoryAssumption(CENTER, positions, 0, [], {
      findLebanonCrossing: () => null,
      findIranCrossing: () => null,
    });
    const poly = result!.polyline;
    assert.deepStrictEqual(poly[poly.length - 1], result!.endPoint);
  });
});
