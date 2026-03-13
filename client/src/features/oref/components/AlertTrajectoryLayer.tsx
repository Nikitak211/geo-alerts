/**
 * Map rendering: multiple back-projected trajectory polylines in Cesium/Resium.
 * One polyline per active alert. Start point refined by Cesium ray-pick on Iran border.
 */

import * as Cesium from "cesium";
import {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Entity, PolylineGraphics } from "resium";
import { useCesium } from "resium";
import { useOrefTrajectory } from "../context/OrefTrajectoryContext";
import type { TrajectoryAlertState } from "../hooks/useTrajectoryAlerts";
import type { GeoPoint } from "../types/oref.types";

const IRAN_BORDER_ID_PREFIX = "iran-border";

function polylineKey(poly: GeoPoint[] | undefined): string {
  if (!poly?.length) return "";
  return `${poly.length}-${poly[0][0]}-${poly[0][1]}-${poly[poly.length - 1][0]}-${poly[poly.length - 1][1]}`;
}

/** Refine trajectory Iran end by casting a ray from Iran toward Israel and picking Iran border. Keeps Israel at start, Iran at end. Only in 3D (ray pick not supported in 2D). */
function refineEndWithPick(
  scene: Cesium.Scene,
  poly: GeoPoint[],
): GeoPoint[] | null {
  if (!scene || poly.length < 2) return null;
  if (scene.mode !== Cesium.SceneMode.SCENE3D) return null;
  const end = poly[poly.length - 1];
  const start = poly[0];
  const endCartesian = Cesium.Cartesian3.fromDegrees(end[0], end[1]);
  const startCartesian = Cesium.Cartesian3.fromDegrees(start[0], start[1]);
  const direction = Cesium.Cartesian3.subtract(
    startCartesian,
    endCartesian,
    new Cesium.Cartesian3(),
  );
  Cesium.Cartesian3.normalize(direction, direction);
  const ray = new Cesium.Ray(endCartesian, direction);
  const result = (scene as unknown as { pickFromRay: (r: Cesium.Ray) => { object?: { id?: unknown }; position?: Cesium.Cartesian3 } | undefined }).pickFromRay(ray);
  if (!result?.object?.id) return null;
  const id = String(result.object.id);
  if (!id.startsWith(IRAN_BORDER_ID_PREFIX)) return null;
  const position = (result as { position?: Cesium.Cartesian3 }).position;
  if (!position) return null;
  const carto = Cesium.Cartographic.fromCartesian(position);
  const lon = Cesium.Math.toDegrees(carto.longitude);
  const lat = Cesium.Math.toDegrees(carto.latitude);
  return [...poly.slice(0, -1), [lon, lat]];
}

/** Ensure polyline runs Israel (west) → Iran (east). If reversed, return a copy in correct order. */
function ensureDirectionIsraelToIran(poly: GeoPoint[]): GeoPoint[] {
  if (!poly?.length || poly.length < 2) return poly;
  const first = poly[0];
  const last = poly[poly.length - 1];
  if (first[0] > last[0]) return [...poly].reverse();
  return poly;
}

const SingleTrajectoryPolyline: FC<{
  item: TrajectoryAlertState;
  poly: GeoPoint[];
}> = memo(function SingleTrajectoryPolyline({ item, poly }) {
  const directed = useMemo(() => ensureDirectionIsraelToIran(poly), [poly]);
  const key = polylineKey(directed);
  const lastKeyRef = useRef<string>("");
  const lastPositionsRef = useRef<Cesium.Cartesian3[]>([]);

  const positions = useMemo(() => {
    if (!directed?.length) return [];
    if (key === lastKeyRef.current && lastPositionsRef.current.length > 0) {
      return lastPositionsRef.current;
    }
    const next = directed.map(([lon, lat]) =>
      Cesium.Cartesian3.fromDegrees(lon, lat),
    );
    lastKeyRef.current = key;
    lastPositionsRef.current = next;
    return next;
  }, [key, directed]);

  if (positions.length < 2) return null;

  return (
    <Entity id={`oref-trajectory-polyline-${item.id}`}>
      <PolylineGraphics
        positions={positions}
        width={3}
        material={Cesium.Color.RED.withAlpha(0.45)}
      />
    </Entity>
  );
});

const AlertTrajectoryLayer: FC = memo(function AlertTrajectoryLayer() {
  const { viewer } = useCesium();
  const { trajectoryAlerts } = useOrefTrajectory();
  const [refinedPolylines, setRefinedPolylines] = useState<
    Record<string, GeoPoint[]>
  >({});
  const refinedRef = useRef<Record<string, GeoPoint[]>>({});

  const runCollisionRefinement = useCallback(() => {
    if (!viewer?.scene || !trajectoryAlerts.length) return;
    const scene = viewer.scene;
    let updated = false;
    const next: Record<string, GeoPoint[]> = { ...refinedRef.current };
    for (const item of trajectoryAlerts) {
      const poly = item.result.polyline;
      if (!poly?.length) continue;
      // Do not refine server/screenshot trajectory so main map matches screenshot exactly.
      if (item.result.source === "iran" || item.result.source === "lebanon") continue;
      const refined = refineEndWithPick(scene, poly);
      if (refined) {
        next[item.id] = refined;
        updated = true;
      }
    }
    if (updated) {
      refinedRef.current = next;
      setRefinedPolylines(next);
    }
  }, [viewer, trajectoryAlerts]);

  useEffect(() => {
    if (!viewer || !trajectoryAlerts.length) return;
    refinedRef.current = {};
    setRefinedPolylines({});
    // Run after two frames so Iran border entities are rendered and pickable
    let raf1: number | undefined;
    const raf2 = requestAnimationFrame(() => {
      raf1 = requestAnimationFrame(() => {
        runCollisionRefinement();
      });
    });
    return () => {
      cancelAnimationFrame(raf2);
      if (raf1 !== undefined) cancelAnimationFrame(raf1);
    };
  }, [viewer, trajectoryAlerts, runCollisionRefinement]);

  const displayPoly = useCallback(
    (item: TrajectoryAlertState): GeoPoint[] => {
      // Use server/screenshot polyline as-is (no refinement) so main map matches screenshot.
      if (item.result.source === "iran" || item.result.source === "lebanon") {
        return item.result.polyline;
      }
      return refinedPolylines[item.id] ?? item.result.polyline;
    },
    [refinedPolylines],
  );

  if (!trajectoryAlerts.length) return null;

  return (
    <>
      {trajectoryAlerts.map((item) => (
        <SingleTrajectoryPolyline
          key={item.id}
          item={item}
          poly={displayPoly(item)}
        />
      ))}
    </>
  );
});

export { AlertTrajectoryLayer };
