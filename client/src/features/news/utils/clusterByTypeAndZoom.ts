import type { NewsCluster, NewsItem, NewsLeaf, NewsMapEntity, NewsType } from "../types";

/** Camera height (meters) above which we show type+grid clusters. */
export const CLUSTER_HEIGHT_THRESHOLD_M = 400_000;

/**
 * Grid cell size in degrees, scaled by camera height.
 * Higher altitude → larger cells.
 */
export function gridSizeDegrees(cameraHeightM: number): number {
  if (cameraHeightM >= 2_000_000) return 2.0;
  if (cameraHeightM >= 1_000_000) return 1.0;
  if (cameraHeightM >= CLUSTER_HEIGHT_THRESHOLD_M) return 0.5;
  return 0.15;
}

function cellKey(type: NewsType, lat: number, lon: number, size: number): string {
  const row = Math.floor(lat / size);
  const col = Math.floor(lon / size);
  return `${type}:${row}:${col}`;
}

function centroid(items: NewsItem[]): { lat: number; lon: number } {
  let lat = 0;
  let lon = 0;
  for (const it of items) {
    lat += it.lat;
    lon += it.lon;
  }
  const n = items.length || 1;
  return { lat: lat / n, lon: lon / n };
}

/**
 * Cluster news by (type, grid cell) when zoomed out.
 * Types never mix. When below height threshold, returns leaves only.
 */
export function clusterByTypeAndZoom(
  items: NewsItem[],
  cameraHeightM: number
): NewsMapEntity[] {
  if (!items.length) return [];

  if (cameraHeightM < CLUSTER_HEIGHT_THRESHOLD_M) {
    return items.map(
      (item): NewsLeaf => ({
        kind: "leaf",
        id: `leaf:${item.id}`,
        item,
      })
    );
  }

  const size = gridSizeDegrees(cameraHeightM);
  const buckets = new Map<string, NewsItem[]>();

  for (const item of items) {
    const key = cellKey(item.type, item.lat, item.lon, size);
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }

  const entities: NewsMapEntity[] = [];
  for (const [key, group] of buckets) {
    if (group.length === 1) {
      entities.push({
        kind: "leaf",
        id: `leaf:${group[0].id}`,
        item: group[0],
      });
      continue;
    }
    const { lat, lon } = centroid(group);
    const type = group[0].type;
    const cluster: NewsCluster = {
      kind: "cluster",
      id: `cluster:${key}`,
      type,
      lat,
      lon,
      count: group.length,
      items: group,
      cellKey: key,
    };
    entities.push(cluster);
  }

  return entities;
}
