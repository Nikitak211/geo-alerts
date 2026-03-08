import { FC, memo } from "react";
import { Viewer } from "resium";
import { SceneMode } from "cesium";
import { Events } from "../../Events";
import { AlertPlacesProvider } from "../../contexts/AlertPlacesContext";
import { AlertTester } from "../AlertTester";
import { LayerPins } from "../LayerPins";
import {
  AlertPinsLayer,
  AlertTrajectoryLayer,
  AlertTrajectoryDebugLayer,
  IranBorderLayer,
  OrefTrajectoryProvider,
} from "../../features/oref";
import { StrikeNewsLayer } from "../../features/strikeNews";

export const MainMap: FC = memo(function MainMap() {
  return (
    <Viewer
      sceneMode={SceneMode.SCENE2D}
      baseLayerPicker={false}
      geocoder={false}
      homeButton={false}
      sceneModePicker={false}
      navigationHelpButton={false}
      fullscreenButton={false}
      selectionIndicator={false}
      timeline={false}
      animation={false}
      style={{
        display: "inline-flex",
        height: "90vh",
        width: "100%",
      }}
    >
      <AlertPlacesProvider>
        <OrefTrajectoryProvider>
          <LayerPins />
          <Events />
          <AlertTester />
          <IranBorderLayer />
          <StrikeNewsLayer />
          <AlertPinsLayer />
          <AlertTrajectoryLayer />
          <AlertTrajectoryDebugLayer />
        </OrefTrajectoryProvider>
      </AlertPlacesProvider>
    </Viewer>
  );
});

MainMap.displayName = "MainMap";
