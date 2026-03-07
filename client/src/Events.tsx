import { Cartesian3, Google2DImageryProvider, ImageryLayer } from "cesium";
import { FC, useEffect, useState } from "react";
import { useCesium } from "resium";

export const Events: FC = () => {
  const { viewer } = useCesium();
  const [, setReady] = useState(false);

  useEffect(() => {
    if (!viewer) return;
    let cancelled = false;
    (async () => {
      const roadmapLayer = await ImageryLayer.fromProviderAsync(
        Google2DImageryProvider.fromIonAssetId({ assetId: "3830183", mapType: "roadmap" }) as Promise<
          import("cesium").ImageryProvider
        >
      );
      const overlay = await ImageryLayer.fromProviderAsync(
        Google2DImageryProvider.fromIonAssetId({
          assetId: "3830183",
          overlayLayerType: "layerRoadmap",
        }) as Promise<import("cesium").ImageryProvider>
      );
      if (cancelled) return;
      viewer.imageryLayers.add(roadmapLayer);
      viewer.imageryLayers.add(overlay);
      viewer.scene.camera.flyTo({
        duration: 0,
        destination: Cartesian3.fromDegrees(35.5727, 33.2076, 150000),
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [viewer]);

  return null;
};
