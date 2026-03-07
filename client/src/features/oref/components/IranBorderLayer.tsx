/**
 * Renders Iran border from ir.json with red/white striped fill (restricted area) and red outline.
 * Stripes are diagonal (-45°) and small (repeat ~12). Uses custom Fabric material for diagonal.
 * Reference layer for trajectory; same data is used for boundary collision.
 */

import * as Cesium from "cesium";
import React, { FC, memo, useMemo } from "react";
import { Entity, PolygonGraphics, PolylineGraphics } from "resium";
import { useOrefTrajectory } from "../context/OrefTrajectoryContext";

function ringToPositions(ring: Array<[number, number]>): Cesium.Cartesian3[] {
  return ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat));
}

/** Close a ring for polyline: positions + positions[0]. */
function closedPolylinePositions(positions: Cesium.Cartesian3[]): Cesium.Cartesian3[] {
  if (positions.length < 2) return positions;
  return [...positions, positions[0]];
}

/**
 * Custom material: red/white stripes at -45° (sideways), smaller repeat.
 * Stripe boundaries run NW–SE; coordinate along stripe axis is (st.s + st.t).
 */
function createIranStripeMaterial(): Cesium.Material {
  return new Cesium.Material({
    fabric: {
      type: "IranDiagonalStripe",
      uniforms: {
        evenColor: new Cesium.Color(1, 1, 1, 1).withAlpha(0.25),
        oddColor: new Cesium.Color(0.9, 0.1, 0.1, 1).withAlpha(0.25),
        repeat: 12,
      },
      source: `
        czm_material czm_getMaterial(czm_materialInput materialInput) {
          czm_material m = czm_getDefaultMaterial(materialInput);
          vec2 st = materialInput.st;
          float u = (st.s + st.t) * repeat;
          float stripe = floor(u);
          float even = mod(stripe, 2.0);
          m.diffuse = mix(oddColor.rgb, evenColor.rgb, even);
          m.alpha = mix(oddColor.a, evenColor.a, even);
          return m;
        }
      `,
    },
  });
}

/** MaterialProperty-compatible object for Iran stripe material (do not extend Cesium.MaterialProperty — it must not be called directly). */
function createIranStripeMaterialProperty(): Cesium.MaterialProperty {
  const material = createIranStripeMaterial();
  const materialAny = material as {
    type: string;
    uniforms?: Record<string, unknown>;
  };
  return {
    definitionChanged: new Cesium.Event(),
    isConstant: true,
    getType: () => material.type,
    getValue: (_time: Cesium.JulianDate, result?: unknown) => {
      const r = (result ?? {}) as Record<string, unknown>;
      r.type = material.type;
      r.uniforms = materialAny.uniforms ?? {};
      return r;
    },
    equals: (other: unknown) => false,
  } as Cesium.MaterialProperty;
}

/** Red/white diagonal stripes for Iran (restricted-area look). */
const IRAN_STRIPE_MATERIAL = createIranStripeMaterialProperty();

const IranBorderLayer: FC = memo(function IranBorderLayer() {
  const { iranGeoJson } = useOrefTrajectory();

  const entities = useMemo(() => {
    if (!iranGeoJson?.length) return [];
    const out: Array<{
      key: string;
      entityId: string;
      positions: Cesium.Cartesian3[];
    }> = [];
    let idx = 0;
    for (const feature of iranGeoJson) {
      const geom = feature?.geometry;
      if (!geom?.coordinates) continue;
      const coords = geom.coordinates as unknown;
      if (
        geom.type === "Polygon" &&
        Array.isArray(coords) &&
        coords[0]?.length
      ) {
        const ring = coords[0] as Array<[number, number]>;
        out.push({
          key: `iran-poly-${idx}`,
          entityId: `iran-border-${idx++}`,
          positions: ringToPositions(ring),
        });
      } else if (geom.type === "MultiPolygon" && Array.isArray(coords)) {
        for (const polygon of coords) {
          const ring = polygon?.[0];
          if (!Array.isArray(ring)) continue;
          out.push({
            key: `iran-multi-${idx}`,
            entityId: `iran-border-${idx++}`,
            positions: ringToPositions(ring as Array<[number, number]>),
          });
        }
      }
    }
    return out;
  }, [iranGeoJson]);

  if (!entities.length) return null;

  const BORDER_WIDTH = 3;

  return (
    <>
      {entities.map(({ key, entityId, positions }) => (
        <React.Fragment key={key}>
          <Entity id={entityId}>
            <PolygonGraphics
              hierarchy={new Cesium.PolygonHierarchy(positions)}
              fill={true}
              material={IRAN_STRIPE_MATERIAL}
              outline={false}
            />
          </Entity>
          <Entity id={`${entityId}-line`}>
            <PolylineGraphics
              positions={closedPolylinePositions(positions)}
              width={BORDER_WIDTH}
              material={Cesium.Color.RED}
            />
          </Entity>
        </React.Fragment>
      ))}
    </>
  );
});

export { IranBorderLayer };
