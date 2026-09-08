import { classifyNewsType } from "../newsTypes";
import { summarizeNews } from "../utils/summarize";
import {
  CLUSTER_HEIGHT_THRESHOLD_M,
  clusterByTypeAndZoom,
} from "../utils/clusterByTypeAndZoom";
import type { NewsItem } from "../types";

function item(
  partial: Partial<NewsItem> & Pick<NewsItem, "id" | "lat" | "lon" | "type" | "title">
): NewsItem {
  return {
    summary: partial.summary ?? partial.title,
    url: partial.url ?? "https://example.com",
    seenAt: partial.seenAt ?? new Date().toISOString(),
    domain: partial.domain ?? "example.com",
    imageUrl: partial.imageUrl ?? null,
    ...partial,
  };
}

describe("classifyNewsType", () => {
  it("maps keywords to types", () => {
    expect(classifyNewsType("Missile strike hits city")).toBe("conflict");
    expect(classifyNewsType("Ceasefire talks resume")).toBe("diplomacy");
    expect(classifyNewsType("Refugee aid convoy")).toBe("humanitarian");
    expect(classifyNewsType("Border security raid")).toBe("security");
    expect(classifyNewsType("Weekly cabinet meeting")).toBe("politics");
  });
});

describe("summarizeNews", () => {
  it("appends domain and truncates", () => {
    const s = summarizeNews("Short title", "bbc.com", 120);
    expect(s).toContain("Short title");
    expect(s).toContain("bbc.com");
    const long = "x".repeat(200);
    expect(summarizeNews(long, "x.com", 40).length).toBeLessThanOrEqual(40);
  });
});

describe("clusterByTypeAndZoom", () => {
  it("returns empty for empty input", () => {
    expect(clusterByTypeAndZoom([], 1_000_000)).toEqual([]);
  });

  it("returns leaves when zoomed in", () => {
    const items = [
      item({ id: "a", lat: 31.5, lon: 34.5, type: "conflict", title: "A" }),
      item({ id: "b", lat: 31.51, lon: 34.51, type: "conflict", title: "B" }),
    ];
    const out = clusterByTypeAndZoom(items, CLUSTER_HEIGHT_THRESHOLD_M - 1);
    expect(out.every((e) => e.kind === "leaf")).toBe(true);
    expect(out).toHaveLength(2);
  });

  it("keeps different types in separate clusters in same cell", () => {
    const items = [
      item({ id: "c1", lat: 31.5, lon: 34.5, type: "conflict", title: "C1" }),
      item({ id: "c2", lat: 31.52, lon: 34.52, type: "conflict", title: "C2" }),
      item({ id: "d1", lat: 31.5, lon: 34.5, type: "diplomacy", title: "D1" }),
      item({ id: "d2", lat: 31.51, lon: 34.51, type: "diplomacy", title: "D2" }),
    ];
    const out = clusterByTypeAndZoom(items, 1_000_000);
    const clusters = out.filter((e) => e.kind === "cluster");
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    const types = new Set(clusters.map((c) => (c.kind === "cluster" ? c.type : "")));
    expect(types.has("conflict")).toBe(true);
    expect(types.has("diplomacy")).toBe(true);
    for (const c of clusters) {
      if (c.kind === "cluster") {
        expect(c.items.every((i) => i.type === c.type)).toBe(true);
      }
    }
  });
});
