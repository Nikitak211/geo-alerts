import { FC, memo, useEffect, useRef, useState } from "react";
import { useCesium } from "resium";
import * as Cesium from "cesium";
import { isExcludedFromBetting } from "../../utils/regionAreas";

type MunicipalityGeoJsonLayerProps = {
  geojsonUrl: string;
  highlightedNames: Set<string>;
};

const DEFAULT_FILL = Cesium.Color.LIGHTGREEN.withAlpha(0.25);
const HIGHLIGHT_FILL = Cesium.Color.RED.withAlpha(0.25);
const STROKE = Cesium.Color.RED;
const STROKE_WIDTH = 2;

export const MunicipalityGeoJsonLayer: FC<MunicipalityGeoJsonLayerProps> = memo(
  ({ geojsonUrl, highlightedNames }) => {
    const { viewer } = useCesium();
    const dsRef = useRef<Cesium.GeoJsonDataSource | null>(null);
    const prevHighlightRef = useRef<Set<string>>(new Set());
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
      if (!viewer) return;
      let cancelled = false;
      (async () => {
        try {
          const ds = await Cesium.GeoJsonDataSource.load(geojsonUrl, {
            stroke: STROKE,
            fill: DEFAULT_FILL,
            strokeWidth: STROKE_WIDTH,
          });
          if (cancelled) {
            viewer.dataSources.remove(ds);
            return;
          }
          for (const entity of ds.entities.values) {
            const munHeb = (entity.properties as any)?.MUN_HEB;
            const name =
              typeof munHeb?.getValue === "function"
                ? munHeb.getValue(Cesium.JulianDate.now())
                : munHeb;
            if (typeof name === "string" && isExcludedFromBetting(name)) {
              entity.show = false;
            }
          }
          dsRef.current = ds;
          viewer.dataSources.add(ds);
          if (!cancelled) setLoaded(true);
        } catch {
          // ignore
        }
      })();
      return () => {
        cancelled = true;
        setLoaded(false);
        if (dsRef.current) {
          viewer.dataSources.remove(dsRef.current);
          dsRef.current = null;
        }
      };
    }, [viewer, geojsonUrl]);

    useEffect(() => {
      const ds = dsRef.current;
      if (!ds) return;

      const entities = ds.entities.values;
      const prev = prevHighlightRef.current;

      for (const entity of entities) {
        if (!entity.polygon) continue;
        const munHeb = (entity.properties as any)?.MUN_HEB;
        const name =
          typeof munHeb?.getValue === "function"
            ? munHeb.getValue(Cesium.JulianDate.now())
            : munHeb;
        if (typeof name !== "string") continue;

        const nowHighlighted = highlightedNames.has(name);
        const wasHighlighted = prev.has(name);

        if (nowHighlighted !== wasHighlighted) {
          entity.polygon.material = nowHighlighted
            ? (HIGHLIGHT_FILL as unknown as Cesium.MaterialProperty)
            : (DEFAULT_FILL as unknown as Cesium.MaterialProperty);
        }
      }

      prevHighlightRef.current = new Set(highlightedNames);
    }, [highlightedNames, loaded]);

    return null;
  },
);
MunicipalityGeoJsonLayer.displayName = "MunicipalityGeoJsonLayer";
