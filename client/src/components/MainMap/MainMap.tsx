import { FC, memo } from "react";
import { ImageryLayer, Viewer } from "resium";
import { SceneMode, UrlTemplateImageryProvider } from "cesium";
import { Events } from "../../Events";
import { AlertPlacesProvider } from "../../contexts/AlertPlacesContext";
import { PlaceResolverProvider } from "../../contexts/PlaceResolverContext";
import { AlertTester } from "../AlertTester";
import { LayerPins } from "../LayerPins";
import {
  AlertPinsLayer,
  AlertTrajectoryLayer,
  AlertTrajectoryDebugLayer,
  IranBorderLayer,
  IrBasesLayer,
  OrefTrajectoryProvider,
  ScreenshotSender,
} from "../../features/oref";

const CITIES_URL = "/data/cities.json";
const GEOJSON_URL = "/data/municipalities.geojson";

export const MainMap: FC = memo(function MainMap() {
  return (
    <Viewer
      sceneMode={SceneMode.SCENE2D}
      contextOptions={{ webgl: { preserveDrawingBuffer: true } }}
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
      <PlaceResolverProvider citiesUrl={CITIES_URL} geojsonUrl={GEOJSON_URL}>
        <AlertPlacesProvider>
          <OrefTrajectoryProvider>
            <LayerPins />
            <Events />
            <ImageryLayer
              imageryProvider={
                new UrlTemplateImageryProvider({
                  url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png",
                })
              }
            />
            <AlertTester />
            <IranBorderLayer />
            <IrBasesLayer />
            <AlertPinsLayer />
            <AlertTrajectoryLayer />
            <AlertTrajectoryDebugLayer />
            <ScreenshotSender />
          </OrefTrajectoryProvider>
        </AlertPlacesProvider>
      </PlaceResolverProvider>
    </Viewer>
  );
});

MainMap.displayName = "MainMap";
