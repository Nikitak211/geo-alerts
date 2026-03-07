import { FC, memo, useEffect, useMemo } from "react";
import { Entity } from "resium";
import { useCesiumCallbackProps } from "../../hooks";
import {
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  PolygonHierarchy,
  Property,
} from "cesium";

type SinglePolygonProps = {
  displayName: string;
  coordinates: [number, number][];
  highlighted: boolean;
};

const DEFAULT_COLOR = Color.LIGHTGREEN.withAlpha(0.25);
const HIGHLIGHT_COLOR = Color.RED.withAlpha(0.25);
const OUTLINE_COLOR = Color.RED;

const CALLBACK_KEYS = [
  "material",
  "outline",
  "outlineColor",
  "position",
] as const;

export const SinglePolygon: FC<SinglePolygonProps> = memo(
  ({ displayName, coordinates, highlighted }) => {
    const {
      material,
      materialRef,
      outline,
      outlineRef,
      outlineColor,
      outlineColorRef,
      position,
      positionRef,
    } = useCesiumCallbackProps(CALLBACK_KEYS);

    const positions: Cartesian3[] = useMemo(
      () =>
        coordinates?.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat)) ??
        [],
      [coordinates],
    );

    const materialProperty = useMemo(
      () => new ColorMaterialProperty(material as unknown as Property),
      [material],
    );

    useEffect(() => {
      materialRef.current = highlighted ? HIGHLIGHT_COLOR : DEFAULT_COLOR;
      outlineRef.current = true;
      outlineColorRef.current = OUTLINE_COLOR;
      positionRef.current = new PolygonHierarchy(positions);
    }, [
      highlighted,
      materialRef,
      outlineColorRef,
      outlineRef,
      positionRef,
      positions,
    ]);

    if (!positions.length) return null;

    return (
      <Entity
        name={displayName}
        properties={{ MUN_HEB: new ConstantProperty(displayName) }}
        polygon={{
          hierarchy: position,
          fill: true,
          material: materialProperty,
          outline: outline,
          outlineWidth: 5,
          outlineColor: outlineColor,
        }}
      />
    );
  },
);
SinglePolygon.displayName = "SinglePolygon";
