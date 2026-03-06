import { Cartesian3, Color } from "cesium";
import { FC } from "react";
import { BillboardGraphics, Entity } from "resium";

import Uav from "./uav.png";
import Missile from "./missile.png";
import Warning from "./warning.png";

enum AlertTypes {
  Rockets = "ירי רקטות וטילים",
  Uav = "חדירת כלי טיס עוין",
  Over = "חדירת כלי טיס עוין - האירוע הסתיים",
}

export const Pin: FC<{
  center: { lat: number; lon: number };
  title: string;
}> = ({ center, title }) => {
  if (AlertTypes.Over === title) return null;

  const icon = () => {
    switch (title) {
      case AlertTypes.Rockets:
        return Missile;
      case AlertTypes.Uav:
        return Uav;
      default:
        return Warning;
    }
  };

  return (
    <Entity position={Cartesian3.fromDegrees(center.lon, center.lat)}>
      <BillboardGraphics color={Color.RED} image={icon()} scale={0.1} />
    </Entity>
  );
};
