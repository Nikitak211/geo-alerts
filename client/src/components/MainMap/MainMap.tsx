import { FC, memo } from "react";
import { Viewer } from "resium";
import { SceneMode } from "cesium";
import { Events } from "../../Events";
import { AlertPlacesProvider } from "../../contexts/AlertPlacesContext";
import { AlertTester } from "../AlertTester";
import { LayerPins } from "../LayerPins";

export const MainMap: FC = memo(({}) => {
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
        <LayerPins />
        <Events />
        <AlertTester />
      </AlertPlacesProvider>
    </Viewer>
  );
});

MainMap.displayName = "MainMap";
