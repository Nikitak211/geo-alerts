/**
 * Optional debug layer: centroid, gate marker, impact labels per active trajectory.
 * Enable with REACT_APP_OREF_TRAJECTORY_DEBUG=true.
 */

import * as Cesium from "cesium";
import { FC, memo } from "react";
import { Entity, LabelGraphics, PointGraphics } from "resium";
import { useOrefTrajectory } from "../context/OrefTrajectoryContext";
import type { TrajectoryAlertState } from "../hooks/useTrajectoryAlerts";

const DEBUG_ENABLED =
  typeof process !== "undefined" &&
  (process as NodeJS.Process & { env?: Record<string, string> }).env
    ?.REACT_APP_OREF_TRAJECTORY_DEBUG === "true";

const SingleDebugMarkers: FC<{ item: TrajectoryAlertState }> = memo(function SingleDebugMarkers({
  item,
}) {
  const { alert, result } = item;
  const polyline = result.polyline;
  if (!alert?.areas?.length || !polyline?.length) return null;

  const gate = polyline[0];
  const centroidPoint = polyline[polyline.length - 1];

  return (
    <>
      <Entity
        position={Cesium.Cartesian3.fromDegrees(centroidPoint[0], centroidPoint[1])}
        name={`oref-debug-centroid-${item.id}`}
      >
        <PointGraphics pixelSize={10} color={Cesium.Color.CYAN} outlineColor={Cesium.Color.WHITE} outlineWidth={2} />
        <LabelGraphics
          text="centroid"
          font="12px sans-serif"
          fillColor={Cesium.Color.CYAN}
          outlineColor={Cesium.Color.BLACK}
          outlineWidth={1}
          pixelOffset={new Cesium.Cartesian2(8, 0)}
          verticalOrigin={Cesium.VerticalOrigin.CENTER}
        />
      </Entity>
      <Entity
        position={Cesium.Cartesian3.fromDegrees(gate[0], gate[1])}
        name={`oref-debug-gate-${item.id}`}
      >
        <PointGraphics pixelSize={12} color={Cesium.Color.MAGENTA} outlineColor={Cesium.Color.WHITE} outlineWidth={2} />
        <LabelGraphics
          text={`gate: ${result.source}`}
          font="12px sans-serif"
          fillColor={Cesium.Color.MAGENTA}
          outlineColor={Cesium.Color.BLACK}
          outlineWidth={1}
          pixelOffset={new Cesium.Cartesian2(8, 0)}
          verticalOrigin={Cesium.VerticalOrigin.CENTER}
        />
      </Entity>
      {alert.areas.map((area, i) => (
        <Entity
          key={`${item.id}-impact-${i}`}
          position={Cesium.Cartesian3.fromDegrees(area.point[0], area.point[1])}
          name={`oref-debug-impact-${item.id}-${i}`}
        >
          <PointGraphics pixelSize={6} color={Cesium.Color.YELLOW} outlineColor={Cesium.Color.BLACK} outlineWidth={1} />
          <LabelGraphics
            text={area.name}
            font="11px sans-serif"
            fillColor={Cesium.Color.YELLOW}
            outlineColor={Cesium.Color.BLACK}
            outlineWidth={1}
            pixelOffset={new Cesium.Cartesian2(6, 0)}
            verticalOrigin={Cesium.VerticalOrigin.CENTER}
          />
        </Entity>
      ))}
    </>
  );
});

const AlertTrajectoryDebugLayer: FC = memo(function AlertTrajectoryDebugLayer() {
  const { trajectoryAlerts } = useOrefTrajectory();

  if (!DEBUG_ENABLED || !trajectoryAlerts.length) return null;

  return (
    <>
      {trajectoryAlerts.map((item) => (
        <SingleDebugMarkers key={item.id} item={item} />
      ))}
    </>
  );
});

export { AlertTrajectoryDebugLayer };
