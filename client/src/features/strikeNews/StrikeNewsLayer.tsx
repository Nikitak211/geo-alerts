/**
 * Billboards for strike news (Iran / Gulf / region). Placeholder icon; replace with your icon later.
 */

import * as Cesium from "cesium";
import React, { FC, memo } from "react";
import { BillboardGraphics, Entity } from "resium";
import { useStrikeNews } from "./useStrikeNews";

const ICON_SIZE = 32;
const PLACEHOLDER_ICON = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="14" fill="%23c62828" stroke="%23fff" stroke-width="2"/>
    <text x="16" y="20" text-anchor="middle" fill="%23fff" font-size="14" font-family="sans-serif">!</text>
  </svg>`
)}`;

const StrikeNewsLayer: FC = memo(function StrikeNewsLayer() {
  const { items } = useStrikeNews();

  return (
    <>
      {items.map((item) => (
        <Entity
          key={item.id}
          id={`strike-news-${item.id}`}
          position={Cesium.Cartesian3.fromDegrees(item.lon, item.lat)}
          name={item.title}
          description={item.url || item.title}
        >
          <BillboardGraphics
            image={PLACEHOLDER_ICON}
            scale={0.8}
            verticalOrigin={Cesium.VerticalOrigin.BOTTOM}
          />
        </Entity>
      ))}
    </>
  );
});

export { StrikeNewsLayer };
