/**
 * Layer of billboards for Iran bases from public/data/ir_bases.json.
 * Clusters when bases are within 45 screen pixels of each other.
 * Click cluster → fly closer so leaves separate.
 */

import * as Cesium from "cesium";
import React, {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BillboardGraphics, Entity, LabelGraphics } from "resium";
import { useCesium } from "resium";
import {
  IR_BASE_CLUSTER_PIXEL_PX,
  clusterIrBasesByPixelDistance,
  type IrBaseMapEntity,
  type IrBasePoint,
  type IrBaseScreenPoint,
} from "../utils/clusterIrBases";

const TARGET_ICON_URL = "/data/target-icon.svg";

export type IrBaseFeature = {
  type: "Feature";
  properties: {
    name: string;
    type?: string;
    city?: string;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
};

const IR_BASES_URL = "/data/ir_bases.json";

const BG = "#22242a";
const FG = "#EAEAEA";
const CLUSTER_FILL = "#c44b3c";

const TooltipSvg = (props: {
  name: string;
  type?: string;
  city?: string;
}): string => {
  const { name, type, city } = props;
  const lines: string[] = [name];
  if (type) lines.push(type);
  if (city) lines.push(city);
  const text = lines
    .map(
      (line, idx) =>
        `<tspan x="8" dy="${idx === 0 ? "0" : "1.2em"}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  const h = 24 + lines.length * 14;
  const w = Math.min(220, Math.max(80, longestLineLen(lines) * 10));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" rx="4" ry="4" fill="${BG}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  <text x="8" y="16" font-family="sans-serif" font-size="16" fill="${FG}">${text}</text>
</svg>`;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function longestLineLen(lines: string[]): number {
  return Math.max(0, ...lines.map((l) => l.length));
}

function svgToDataUrl(svgStr: string): string {
  const encoded = btoa(unescape(encodeURIComponent(svgStr)));
  return `data:image/svg+xml;base64,${encoded}`;
}

function makeClusterDataUrl(count: number): string {
  const text = count > 99 ? "99+" : String(count);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
  <rect x="2" y="2" width="32" height="32" rx="2" fill="${CLUSTER_FILL}" stroke="#1a1d1a" stroke-width="2"/>
  <text x="18" y="23" text-anchor="middle" font-family="monospace" font-size="12" font-weight="700" fill="#1a1d1a">${text}</text>
</svg>`;
  return svgToDataUrl(svg);
}

function featuresToPoints(features: IrBaseFeature[]): IrBasePoint[] {
  return features.map((f, i) => {
    const [lon, lat] = f.geometry.coordinates;
    const name = f.properties.name || `base-${i}`;
    return {
      id: `${name}-${lon.toFixed(3)}-${lat.toFixed(3)}`,
      name,
      baseType: f.properties.type?.trim() || "Unknown",
      city: f.properties.city,
      lon,
      lat,
    };
  });
}

function projectToScreen(
  viewer: Cesium.Viewer,
  points: IrBasePoint[]
): IrBaseScreenPoint[] {
  const scene = viewer.scene;
  const scratch = new Cesium.Cartesian2();
  return points.map((p) => {
    const cartesian = Cesium.Cartesian3.fromDegrees(p.lon, p.lat);
    const win = scene.cartesianToCanvasCoordinates(cartesian, scratch);
    if (!win || !Number.isFinite(win.x) || !Number.isFinite(win.y)) {
      return { ...p };
    }
    return { ...p, x: win.x, y: win.y };
  });
}

const IrBasesLayer: FC = memo(function IrBasesLayer() {
  const { viewer } = useCesium();
  const [bases, setBases] = useState<IrBaseFeature[]>([]);
  const [entities, setEntities] = useState<IrBaseMapEntity[]>([]);

  useEffect(() => {
    fetch(IR_BASES_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { features?: IrBaseFeature[] } | null) => {
        if (data?.features?.length) setBases(data.features);
      })
      .catch(() => {});
  }, []);

  const points = useMemo(() => featuresToPoints(bases), [bases]);

  const recluster = useCallback(() => {
    if (!viewer || !points.length) {
      setEntities([]);
      return;
    }
    const screenPts = projectToScreen(viewer, points);
    setEntities(
      clusterIrBasesByPixelDistance(screenPts, IR_BASE_CLUSTER_PIXEL_PX)
    );
  }, [viewer, points]);

  useEffect(() => {
    if (!viewer) return;
    let timer: number | null = null;
    const schedule = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        recluster();
      }, 80);
    };
    recluster();
    const removeChanged = viewer.camera.changed.addEventListener(schedule);
    const removeMoveEnd = viewer.camera.moveEnd.addEventListener(() => {
      if (timer != null) window.clearTimeout(timer);
      recluster();
    });
    viewer.camera.percentageChanged = 0.02;
    return () => {
      if (timer != null) window.clearTimeout(timer);
      removeChanged();
      removeMoveEnd();
    };
  }, [viewer, recluster]);

  const flyToCluster = useCallback(
    (lon: number, lat: number) => {
      if (!viewer) return;
      const current =
        viewer.camera.positionCartographic?.height ?? 500_000;
      const nextHeight = Math.max(40_000, current * 0.35);
      viewer.camera.flyTo({
        duration: 0.7,
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, nextHeight),
      });
    },
    [viewer]
  );

  useEffect(() => {
    if (!viewer) return;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position);
      if (!picked || typeof picked !== "object") return;
      const anyPicked = picked as {
        id?: Cesium.Entity;
        primitive?: { id?: Cesium.Entity };
      };
      const entity = anyPicked.id ?? anyPicked.primitive?.id;
      if (!entity?.properties) return;
      const kindProp = entity.properties.irBaseKind;
      const kind =
        typeof kindProp?.getValue === "function"
          ? String(kindProp.getValue(Cesium.JulianDate.now()) ?? "")
          : String(kindProp ?? "");
      if (kind !== "cluster") return;
      const lonProp = entity.properties.irBaseLon;
      const latProp = entity.properties.irBaseLat;
      const lon =
        typeof lonProp?.getValue === "function"
          ? Number(lonProp.getValue(Cesium.JulianDate.now()))
          : Number(lonProp);
      const lat =
        typeof latProp?.getValue === "function"
          ? Number(latProp.getValue(Cesium.JulianDate.now()))
          : Number(latProp);
      if (Number.isFinite(lon) && Number.isFinite(lat)) flyToCluster(lon, lat);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => handler.destroy();
  }, [viewer, flyToCluster]);

  if (!entities.length) return null;

  return (
    <>
      {entities.map((e) => {
        if (e.kind === "leaf") {
          const { point } = e;
          const svgStr = TooltipSvg({
            name: point.name,
            type: point.baseType,
            city: point.city,
          });
          const tooltipDataUrl = svgToDataUrl(svgStr);
          return (
            <React.Fragment key={e.id}>
              <Entity
                position={Cesium.Cartesian3.fromDegrees(point.lon, point.lat)}
                name={point.name}
                properties={{ irBaseKind: "leaf" }}
              >
                <BillboardGraphics
                  image={TARGET_ICON_URL}
                  scale={1}
                  color={Cesium.Color.WHITE}
                  horizontalOrigin={Cesium.HorizontalOrigin.CENTER}
                  verticalOrigin={Cesium.VerticalOrigin.BOTTOM}
                />
              </Entity>
              <Entity
                position={Cesium.Cartesian3.fromDegrees(point.lon, point.lat)}
              >
                <BillboardGraphics
                  image={tooltipDataUrl}
                  scale={1}
                  horizontalOrigin={Cesium.HorizontalOrigin.CENTER}
                  verticalOrigin={Cesium.VerticalOrigin.TOP}
                  pixelOffset={new Cesium.Cartesian2(0, 0)}
                  scaleByDistance={
                    new Cesium.NearFarScalar(1e6, 0.8, 5e6, 0.3)
                  }
                />
              </Entity>
            </React.Fragment>
          );
        }

        return (
          <Entity
            key={e.id}
            id={e.id}
            name={`IR bases · ${e.count}`}
            position={Cesium.Cartesian3.fromDegrees(e.lon, e.lat)}
            properties={{
              irBaseKind: "cluster",
              irBaseLon: e.lon,
              irBaseLat: e.lat,
            }}
          >
            <BillboardGraphics
              image={makeClusterDataUrl(e.count)}
              scale={1}
              verticalOrigin={Cesium.VerticalOrigin.CENTER}
              horizontalOrigin={Cesium.HorizontalOrigin.CENTER}
              disableDepthTestDistance={Number.POSITIVE_INFINITY}
            />
            <LabelGraphics
              text={`IR bases · ${e.count}`}
              font="11px monospace"
              fillColor={Cesium.Color.fromCssColorString("#c5d0b8")}
              outlineColor={Cesium.Color.fromCssColorString("#1a1d1a")}
              outlineWidth={3}
              style={Cesium.LabelStyle.FILL_AND_OUTLINE}
              verticalOrigin={Cesium.VerticalOrigin.TOP}
              pixelOffset={new Cesium.Cartesian2(0, 20)}
              disableDepthTestDistance={Number.POSITIVE_INFINITY}
              showBackground
              backgroundColor={Cesium.Color.fromCssColorString(
                "#242824"
              ).withAlpha(0.85)}
            />
          </Entity>
        );
      })}
    </>
  );
});

export { IrBasesLayer };
