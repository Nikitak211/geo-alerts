import {
  IR_BASE_CLUSTER_PIXEL_PX,
  clusterIrBasesByPixelDistance,
  type IrBaseScreenPoint,
} from "./clusterIrBases";

function pt(
  partial: Partial<IrBaseScreenPoint> &
    Pick<IrBaseScreenPoint, "id" | "lat" | "lon" | "baseType" | "name">
): IrBaseScreenPoint {
  return { city: partial.city, x: partial.x, y: partial.y, ...partial };
}

describe("clusterIrBasesByPixelDistance", () => {
  it("returns empty for empty input", () => {
    expect(clusterIrBasesByPixelDistance([])).toEqual([]);
  });

  it("keeps points farther than 45px as separate leaves", () => {
    const points = [
      pt({
        id: "a",
        lat: 35,
        lon: 51,
        baseType: "IRIAF",
        name: "A",
        x: 100,
        y: 100,
      }),
      pt({
        id: "b",
        lat: 36,
        lon: 52,
        baseType: "IRIAF",
        name: "B",
        x: 100 + IR_BASE_CLUSTER_PIXEL_PX + 1,
        y: 100,
      }),
    ];
    const out = clusterIrBasesByPixelDistance(points);
    expect(out.every((e) => e.kind === "leaf")).toBe(true);
    expect(out).toHaveLength(2);
  });

  it("merges points within 45px regardless of type", () => {
    const points = [
      pt({
        id: "a",
        lat: 35,
        lon: 51,
        baseType: "IRIAF Tactical",
        name: "A",
        x: 100,
        y: 100,
      }),
      pt({
        id: "b",
        lat: 35.1,
        lon: 51.1,
        baseType: "Underground",
        name: "B",
        x: 100 + 30,
        y: 100,
      }),
      pt({
        id: "c",
        lat: 40,
        lon: 60,
        baseType: "IRIAF",
        name: "C",
        x: 500,
        y: 500,
      }),
    ];
    const out = clusterIrBasesByPixelDistance(points, 45);
    const clusters = out.filter((e) => e.kind === "cluster");
    const leaves = out.filter((e) => e.kind === "leaf");
    expect(clusters).toHaveLength(1);
    expect(leaves).toHaveLength(1);
    if (clusters[0].kind === "cluster") {
      expect(clusters[0].count).toBe(2);
    }
  });

  it("chains transitive neighbors within 45px into one cluster", () => {
    // A--30px--B--30px--C  (A to C is 60px but linked via B)
    const points = [
      pt({
        id: "a",
        lat: 1,
        lon: 1,
        baseType: "t",
        name: "A",
        x: 0,
        y: 0,
      }),
      pt({
        id: "b",
        lat: 1,
        lon: 1,
        baseType: "t",
        name: "B",
        x: 30,
        y: 0,
      }),
      pt({
        id: "c",
        lat: 1,
        lon: 1,
        baseType: "t",
        name: "C",
        x: 60,
        y: 0,
      }),
    ];
    const out = clusterIrBasesByPixelDistance(points, 45);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("cluster");
    if (out[0].kind === "cluster") expect(out[0].count).toBe(3);
  });
});
