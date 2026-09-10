import { FC, memo, useEffect, useState } from "react";
import { Box } from "@mui/material";
import { ImageryLayer, Viewer } from "resium";
import { Credit, SceneMode, UrlTemplateImageryProvider } from "cesium";
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
import {
  NewsMarkersLayer,
  NewsSelectionProvider,
  NewsScopeDrawer,
  useNewsSelection,
} from "../../features/news";
import {
  configuredMapTiles,
  fallbackMapTiles,
  type MapTileConfig,
} from "../../utils/mapTiles";

const CITIES_URL = "/data/cities.json";
const GEOJSON_URL = "/data/municipalities.geojson";

type MainMapProps = { toolbarVisible?: boolean };

/**
 * Single stable ImageryProvider instance — avoids Cesium removing and re-adding the
 * base tile layer on every React render.  Must be created outside the component so
 * the reference never changes.
 */
function createImageryProvider(config: MapTileConfig) {
  return new UrlTemplateImageryProvider({
    url: config.url,
    credit: new Credit(config.attribution, true),
    maximumLevel: config.maximumLevel,
  });
}

const CONFIGURED_IMAGERY_PROVIDER = createImageryProvider(configuredMapTiles);
const FALLBACK_IMAGERY_PROVIDER = createImageryProvider(fallbackMapTiles);

/** Cesium context options with stable identity so the Viewer never remounts. */
const VIEWER_CONTEXT_OPTIONS = { webgl: { preserveDrawingBuffer: true } } as const;

/** Stable style object — parent flex container sizes the map; viewer fills it. */
const VIEWER_STYLE = { display: "block", height: "100%", width: "100%" } as const;

const NewsScopeHost: FC = () => {
  const { selection, close, openLeaf } = useNewsSelection();
  return (
    <NewsScopeDrawer
      selection={selection}
      onClose={close}
      onSelectMember={(item) => openLeaf(item)}
    />
  );
};

export const MainMap: FC<MainMapProps> = memo(function MainMap({
  toolbarVisible: _toolbarVisible = false,
}) {
  const [imageryProvider, setImageryProvider] = useState(
    CONFIGURED_IMAGERY_PROVIDER,
  );

  useEffect(() => {
    if (configuredMapTiles.provider !== "stadia") return;

    return CONFIGURED_IMAGERY_PROVIDER.errorEvent.addEventListener(() => {
      setImageryProvider(FALLBACK_IMAGERY_PROVIDER);
    });
  }, []);

  return (
    <NewsSelectionProvider>
      <Box sx={{ position: "relative", height: "100%", width: "100%" }}>
        <Viewer
          sceneMode={SceneMode.SCENE2D}
          contextOptions={VIEWER_CONTEXT_OPTIONS}
          baseLayerPicker={false}
          baseLayer={false}
          geocoder={false}
          homeButton={false}
          sceneModePicker={false}
          navigationHelpButton={false}
          fullscreenButton={false}
          selectionIndicator={false}
          timeline={false}
          animation={false}
          style={VIEWER_STYLE}
        >
          <PlaceResolverProvider citiesUrl={CITIES_URL} geojsonUrl={GEOJSON_URL}>
            <AlertPlacesProvider>
              <OrefTrajectoryProvider>
                <LayerPins />
                <Events />
                <ImageryLayer imageryProvider={imageryProvider} />
                <AlertTester />
                <IranBorderLayer />
                <IrBasesLayer />
                <AlertPinsLayer />
                <AlertTrajectoryLayer />
                <AlertTrajectoryDebugLayer />
                <NewsMarkersLayer />
                <ScreenshotSender />
              </OrefTrajectoryProvider>
            </AlertPlacesProvider>
          </PlaceResolverProvider>
        </Viewer>
        <Box
          id="news-map-overlay"
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 11,
          }}
        />
        <NewsScopeHost />
      </Box>
    </NewsSelectionProvider>
  );
});

MainMap.displayName = "MainMap";
