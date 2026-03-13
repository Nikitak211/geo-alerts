/**
 * Map rendering: pins for all active trajectory alerts (each alert's impact areas).
 */

import * as Cesium from "cesium";
import { FC, memo } from "react";
import { BillboardGraphics, Entity } from "resium";
import { useOrefTrajectory } from "../context/OrefTrajectoryContext";

import Missile from "../../../components/Pin/missile.png";

const AlertPinsLayer: FC = memo(function AlertPinsLayer() {
  const { trajectoryAlerts } = useOrefTrajectory();

  return (
    <>
      {trajectoryAlerts.map((item) =>
        (item.alert?.areas ?? []).map((area, i) => (
          <Entity
            key={`${item.id}-${area.name}-${i}`}
            position={Cesium.Cartesian3.fromDegrees(area.point[0], area.point[1])}
          >
            <BillboardGraphics
              image={Missile}
              scale={0.1}
              color={Cesium.Color.RED}
            />
          </Entity>
        ))
      )}
    </>
  );
});

export { AlertPinsLayer };
