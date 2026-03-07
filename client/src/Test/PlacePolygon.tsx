import { FC } from "react";
import * as Cesium from "cesium";
import { Entity, PolygonGraphics } from "resium";
import { useCesiumCallbackProps } from "../hooks";

export type PlaceData = {
  displayName: string;
  coordinates: [number, number][];
};

type PlacePolygonProps = {
  place: PlaceData;
  highlighted: boolean;
};

const DEFAULT_COLOR = Cesium.Color.LIGHTGREEN.withAlpha(0.25);
const HIGHLIGHT_COLOR = Cesium.Color.RED.withAlpha(0.25);

const POLYGON_CALLBACK_KEYS = ["hierarchy", "material"] as const;

export const PlacePolygon: FC<PlacePolygonProps> = ({ place, highlighted }) => {
  const { hierarchy, hierarchyRef, material, materialRef } =
    useCesiumCallbackProps(POLYGON_CALLBACK_KEYS);

  const positions = place.coordinates.map(([lon, lat]) =>
    Cesium.Cartesian3.fromDegrees(lon, lat),
  );
  hierarchyRef.current = new Cesium.PolygonHierarchy(positions);
  materialRef.current = highlighted ? HIGHLIGHT_COLOR : DEFAULT_COLOR;

  return (
    <Entity name={place.displayName}>
      <PolygonGraphics
        hierarchy={hierarchy}
        material={material as Cesium.MaterialProperty}
        outline
        outlineWidth={5}
        outlineColor={Cesium.Color.RED}
      />
    </Entity>
  );
};
