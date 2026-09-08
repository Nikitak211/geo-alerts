/**
 * Cesium news markers: type+zoom clustering, hover tooltip, click → flyTo + scope.
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
import { createPortal } from "react-dom";
import { BillboardGraphics, Entity, LabelGraphics } from "resium";
import { useCesium } from "resium";
import { NEWS_TYPE_COLOR, NEWS_TYPE_LABEL } from "../newsTypes";
import { useMeNews } from "../hooks/useMeNews";
import { useNewsSelection } from "../context/NewsSelectionContext";
import {
  CLUSTER_HEIGHT_THRESHOLD_M,
  clusterByTypeAndZoom,
} from "../utils/clusterByTypeAndZoom";
import { summarizeNews } from "../utils/summarize";
import type { NewsMapEntity, NewsType } from "../types";
import { NewsHoverTooltip } from "./NewsHoverTooltip";

const PROP_KIND = "newsKind";
const PROP_ENTITY_ID = "newsEntityId";

type HoverState = {
  visible: boolean;
  x: number;
  y: number;
  type: NewsType;
  summary: string;
  domain: string;
  isCluster?: boolean;
  count?: number;
};

function hexToCesiumColor(hex: string, alpha = 1): Cesium.Color {
  try {
    return Cesium.Color.fromCssColorString(hex).withAlpha(alpha);
  } catch {
    return Cesium.Color.WHITE.withAlpha(alpha);
  }
}

function makePinDataUrl(color: string, label: string): string {
  const safe = label.replace(/[<>&]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="11" fill="${color}" stroke="#1a1d1a" stroke-width="2"/>
  <text x="14" y="18" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="#1a1d1a">${safe}</text>
</svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function makeClusterDataUrl(color: string, count: number): string {
  const text = count > 99 ? "99+" : String(count);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
  <rect x="2" y="2" width="32" height="32" rx="2" fill="${color}" stroke="#1a1d1a" stroke-width="2"/>
  <text x="18" y="23" text-anchor="middle" font-family="monospace" font-size="12" font-weight="700" fill="#1a1d1a">${text}</text>
</svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function readEntityMeta(
  picked: unknown,
  entityIndex: Map<string, NewsMapEntity>
): NewsMapEntity | null {
  if (!picked || typeof picked !== "object") return null;
  const anyPicked = picked as {
    id?: Cesium.Entity;
    primitive?: { id?: Cesium.Entity };
  };
  const entity = anyPicked.id ?? anyPicked.primitive?.id;
  if (!entity) return null;
  const props = entity.properties;
  if (!props) return null;
  const idProp = props[PROP_ENTITY_ID];
  const id =
    typeof idProp?.getValue === "function"
      ? String(idProp.getValue(Cesium.JulianDate.now()) ?? "")
      : String(idProp ?? "");
  if (!id) return null;
  return entityIndex.get(id) ?? null;
}

export const NewsMarkersLayer: FC = memo(function NewsMarkersLayer() {
  const { viewer } = useCesium();
  const { items } = useMeNews();
  const { openLeaf, openCluster, registerFlyTo } = useNewsSelection();
  const [cameraHeight, setCameraHeight] = useState(150_000);
  const [hover, setHover] = useState<HoverState>({
    visible: false,
    x: 0,
    y: 0,
    type: "politics",
    summary: "",
    domain: "",
  });
  const entityIndexRef = useRef<Map<string, NewsMapEntity>>(new Map());
  const overlayHost =
    typeof document !== "undefined"
      ? document.getElementById("news-map-overlay")
      : null;

  useEffect(() => {
    if (!viewer) return;
    const updateHeight = () => {
      const h = viewer.camera.positionCartographic?.height;
      if (Number.isFinite(h)) setCameraHeight(h as number);
    };
    updateHeight();
    const remove = viewer.camera.changed.addEventListener(updateHeight);
    return () => {
      remove();
    };
  }, [viewer]);

  const entities = useMemo(
    () => clusterByTypeAndZoom(items, cameraHeight),
    [items, cameraHeight]
  );

  useEffect(() => {
    const map = new Map<string, NewsMapEntity>();
    for (const e of entities) map.set(e.id, e);
    entityIndexRef.current = map;
  }, [entities]);

  const flyTo = useCallback(
    (lon: number, lat: number, height: number) => {
      if (!viewer) return;
      viewer.camera.flyTo({
        duration: 0.8,
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      });
    },
    [viewer]
  );

  useEffect(() => {
    registerFlyTo(flyTo);
    return () => registerFlyTo(null);
  }, [flyTo, registerFlyTo]);

  const handleSelect = useCallback(
    (meta: NewsMapEntity) => {
      if (meta.kind === "leaf") {
        openLeaf(meta.item);
        return;
      }
      flyTo(meta.lon, meta.lat, CLUSTER_HEIGHT_THRESHOLD_M * 0.45);
      openCluster(meta);
    },
    [flyTo, openLeaf, openCluster]
  );

  useEffect(() => {
    if (!viewer) return;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
      const picked = viewer.scene.pick(movement.endPosition);
      const meta = readEntityMeta(picked, entityIndexRef.current);
      if (!meta) {
        setHover((h) => (h.visible ? { ...h, visible: false } : h));
        viewer.canvas.style.cursor = "";
        return;
      }
      viewer.canvas.style.cursor = "pointer";
      if (meta.kind === "leaf") {
        setHover({
          visible: true,
          x: movement.endPosition.x,
          y: movement.endPosition.y,
          type: meta.item.type,
          summary: summarizeNews(meta.item.title, meta.item.domain),
          domain: meta.item.domain,
          isCluster: false,
        });
      } else {
        setHover({
          visible: true,
          x: movement.endPosition.x,
          y: movement.endPosition.y,
          type: meta.type,
          summary: `${NEWS_TYPE_LABEL[meta.type]} · ${meta.count} reports`,
          domain: "",
          isCluster: true,
          count: meta.count,
        });
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position);
      const meta = readEntityMeta(picked, entityIndexRef.current);
      if (meta) handleSelect(meta);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
      viewer.canvas.style.cursor = "";
    };
  }, [viewer, handleSelect]);

  const tooltipPortal =
    overlayHost &&
    createPortal(
      <NewsHoverTooltip
        visible={hover.visible}
        x={hover.x}
        y={hover.y}
        type={hover.type}
        summary={hover.summary}
        domain={hover.domain}
        isCluster={hover.isCluster}
        count={hover.count}
      />,
      overlayHost
    );

  return (
    <>
      {entities.map((e) => {
        if (e.kind === "leaf") {
          const color = NEWS_TYPE_COLOR[e.item.type];
          const letter = NEWS_TYPE_LABEL[e.item.type].charAt(0);
          return (
            <Entity
              key={e.id}
              id={e.id}
              name={e.item.title}
              position={Cesium.Cartesian3.fromDegrees(e.item.lon, e.item.lat)}
              properties={{
                [PROP_KIND]: "leaf",
                [PROP_ENTITY_ID]: e.id,
              }}
            >
              <BillboardGraphics
                image={makePinDataUrl(color, letter)}
                scale={1}
                verticalOrigin={Cesium.VerticalOrigin.CENTER}
                horizontalOrigin={Cesium.HorizontalOrigin.CENTER}
                disableDepthTestDistance={Number.POSITIVE_INFINITY}
              />
            </Entity>
          );
        }

        const color = NEWS_TYPE_COLOR[e.type];
        return (
          <Entity
            key={e.id}
            id={e.id}
            name={`${NEWS_TYPE_LABEL[e.type]} · ${e.count}`}
            position={Cesium.Cartesian3.fromDegrees(e.lon, e.lat)}
            properties={{
              [PROP_KIND]: "cluster",
              [PROP_ENTITY_ID]: e.id,
            }}
          >
            <BillboardGraphics
              image={makeClusterDataUrl(color, e.count)}
              scale={1}
              verticalOrigin={Cesium.VerticalOrigin.CENTER}
              horizontalOrigin={Cesium.HorizontalOrigin.CENTER}
              disableDepthTestDistance={Number.POSITIVE_INFINITY}
            />
            <LabelGraphics
              text={`${NEWS_TYPE_LABEL[e.type]} · ${e.count}`}
              font="11px monospace"
              fillColor={hexToCesiumColor("#c5d0b8")}
              outlineColor={hexToCesiumColor("#1a1d1a")}
              outlineWidth={3}
              style={Cesium.LabelStyle.FILL_AND_OUTLINE}
              verticalOrigin={Cesium.VerticalOrigin.TOP}
              pixelOffset={new Cesium.Cartesian2(0, 20)}
              disableDepthTestDistance={Number.POSITIVE_INFINITY}
              showBackground
              backgroundColor={hexToCesiumColor("#242824", 0.85)}
            />
          </Entity>
        );
      })}
      {tooltipPortal}
    </>
  );
});

NewsMarkersLayer.displayName = "NewsMarkersLayer";
