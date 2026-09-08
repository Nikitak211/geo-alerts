/**
 * Cluster Iran bases by screen-pixel distance (types may mix).
 * Two bases merge when their canvas distance is <= thresholdPx (default 45).
 */

export const IR_BASE_CLUSTER_PIXEL_PX = 45;

export type IrBasePoint = {
  id: string;
  name: string;
  baseType: string;
  city?: string;
  lon: number;
  lat: number;
};

export type IrBaseScreenPoint = IrBasePoint & {
  /** Canvas X (pixels); omit if off-screen / not projectable. */
  x?: number;
  /** Canvas Y (pixels). */
  y?: number;
};

export type IrBaseLeaf = {
  kind: "leaf";
  id: string;
  point: IrBasePoint;
};

export type IrBaseCluster = {
  kind: "cluster";
  id: string;
  lat: number;
  lon: number;
  count: number;
  points: IrBasePoint[];
};

export type IrBaseMapEntity = IrBaseLeaf | IrBaseCluster;

function centroid(points: IrBasePoint[]): { lat: number; lon: number } {
  let lat = 0;
  let lon = 0;
  for (const p of points) {
    lat += p.lat;
    lon += p.lon;
  }
  const n = points.length || 1;
  return { lat: lat / n, lon: lon / n };
}

function toCluster(id: string, points: IrBasePoint[]): IrBaseCluster {
  const { lat, lon } = centroid(points);
  return {
    kind: "cluster",
    id,
    lat,
    lon,
    count: points.length,
    points,
  };
}

function pixelDist(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/**
 * Union-find clustering: connect screen points within thresholdPx, then emit
 * clusters (2+) and leaves (1). Points without x/y stay as leaves.
 */
export function clusterIrBasesByPixelDistance(
  points: IrBaseScreenPoint[],
  thresholdPx: number = IR_BASE_CLUSTER_PIXEL_PX
): IrBaseMapEntity[] {
  if (!points.length) return [];

  const n = points.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    let cur = i;
    while (parent[cur] !== r) {
      const next = parent[cur];
      parent[cur] = r;
      cur = next;
    }
    return r;
  };

  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    const pi = points[i];
    if (pi.x == null || pi.y == null) continue;
    for (let j = i + 1; j < n; j++) {
      const pj = points[j];
      if (pj.x == null || pj.y == null) continue;
      if (
        pixelDist({ x: pi.x, y: pi.y }, { x: pj.x, y: pj.y }) <= thresholdPx
      ) {
        unite(i, j);
      }
    }
  }

  const groups = new Map<number, IrBaseScreenPoint[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = groups.get(root);
    if (list) list.push(points[i]);
    else groups.set(root, [points[i]]);
  }

  const entities: IrBaseMapEntity[] = [];
  let clusterIdx = 0;
  for (const group of groups.values()) {
    if (group.length === 1) {
      const p = group[0];
      entities.push({
        kind: "leaf",
        id: `leaf:${p.id}`,
        point: p,
      });
      continue;
    }
    entities.push(toCluster(`cluster:px-${clusterIdx++}`, group));
  }

  return entities;
}

/** @deprecated Use clusterIrBasesByPixelDistance */
export function clusterIrBasesByZoom(
  points: IrBasePoint[],
  _cameraHeightM: number
): IrBaseMapEntity[] {
  return points.map((point) => ({
    kind: "leaf" as const,
    id: `leaf:${point.id}`,
    point,
  }));
}

/** @deprecated */
export const clusterIrBasesByTypeAndZoom = clusterIrBasesByZoom;
export const IR_BASE_CLUSTER_HEIGHT_M = 400_000;
export const IR_BASE_NATIONAL_HEIGHT_M = 1_200_000;
