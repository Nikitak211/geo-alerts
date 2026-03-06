import { FC, memo, useCallback, useEffect, useRef } from "react";
import { Viewer } from "resium";
import { IonGeocodeProviderType, SceneMode } from "cesium";
import * as Cesium from "cesium";
import { Events } from "../../Events";
import AlertTester from "../../Test/AlertTester";
import { LayerPins } from "../LayerPins";
type SelectedArea = {
  areaHeb: string;
  entityId: string;
};

type MainMapProps = {
  onAreaSelect: (area: SelectedArea) => void;
};

export const MainMap: FC<MainMapProps> = memo(({ onAreaSelect }) => {
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const handlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null);

  const handleLeftClick = useCallback(
    (movement: any) => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      const picked = viewer.scene.pick(movement.position);
      if (!Cesium.defined(picked) || !picked.id) return;

      const entity = picked.id as Cesium.Entity;
      const props = entity.properties;
      if (!props) return;

      const munProp = (props as any).MUN_HEB;
      const areaHeb =
        typeof munProp?.getValue === "function"
          ? munProp.getValue(Cesium.JulianDate.now())
          : munProp;

      if (!areaHeb || typeof areaHeb !== "string") return;

      onAreaSelect({
        areaHeb,
        entityId: String(entity.id),
      });
    },
    [onAreaSelect],
  );

  const onViewerMount = useCallback(
    (viewer: Cesium.Viewer | null) => {
      if (!viewer) return;

      viewerRef.current = viewer;

      handlerRef.current?.destroy();
      handlerRef.current = new Cesium.ScreenSpaceEventHandler(
        viewer.scene.canvas,
      );

      handlerRef.current.setInputAction(
        handleLeftClick,
        Cesium.ScreenSpaceEventType.LEFT_CLICK,
      );
    },
    [handleLeftClick],
  );

  useEffect(() => {
    return () => {
      handlerRef.current?.destroy();
      handlerRef.current = null;
    };
  }, []);

  return (
    <Viewer
      sceneMode={SceneMode.SCENE2D}
      baseLayerPicker={false}
      geocoder={IonGeocodeProviderType.GOOGLE}
      timeline={false}
      animation={false}
      ref={(r) => {
        if (r?.cesiumElement) {
          onViewerMount(r.cesiumElement);
        }
      }}
      style={{
        display: "inline-flex",
        height: "90vh",
        width: "100%",
      }}
    >
      <LayerPins />
      <Events />
      <AlertTester />
    </Viewer>
  );
});

MainMap.displayName = "MainMap";
