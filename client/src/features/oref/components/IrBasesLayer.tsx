/**
 * Layer of billboards for Iran bases from public/data/ir_bases.json.
 * Target icon: diamond (rectangle rotated 45°), red/pink fill, red border, 10px.
 * Tooltip: custom SVG billboard with name, type, city (theme styling).
 */

import * as Cesium from "cesium";
import React, { FC, memo, useEffect, useState } from "react";
import { BillboardGraphics, Entity } from "resium";

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

const IrBasesLayer: FC = memo(function IrBasesLayer() {
  const [bases, setBases] = useState<IrBaseFeature[]>([]);

  useEffect(() => {
    fetch(IR_BASES_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { features?: IrBaseFeature[] } | null) => {
        if (data?.features?.length) setBases(data.features);
      })
      .catch(() => {});
  }, []);

  if (!bases.length) return null;

  return (
    <>
      {bases.map((f, i) => {
        const [lon, lat] = f.geometry.coordinates;
        const svgStr = TooltipSvg(f.properties);
        const tooltipDataUrl = svgToDataUrl(svgStr);
        return (
          <React.Fragment key={`ir-base-${i}-${f.properties.name}`}>
            <Entity
              position={Cesium.Cartesian3.fromDegrees(lon, lat)}
              name={f.properties.name}
            >
              <BillboardGraphics
                image={TARGET_ICON_URL}
                scale={1}
                color={Cesium.Color.WHITE}
                horizontalOrigin={Cesium.HorizontalOrigin.CENTER}
                verticalOrigin={Cesium.VerticalOrigin.BOTTOM}
              />
            </Entity>
            <Entity position={Cesium.Cartesian3.fromDegrees(lon, lat)}>
              <BillboardGraphics
                image={tooltipDataUrl}
                scale={1}
                horizontalOrigin={Cesium.HorizontalOrigin.CENTER}
                verticalOrigin={Cesium.VerticalOrigin.TOP}
                pixelOffset={new Cesium.Cartesian2(0, 0)}
                scaleByDistance={new Cesium.NearFarScalar(1e6, 0.8, 5e6, 0.3)}
              />
            </Entity>
          </React.Fragment>
        );
      })}
    </>
  );
});

export { IrBasesLayer };
