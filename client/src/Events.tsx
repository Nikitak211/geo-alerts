import { Cartesian3, Google2DImageryProvider, ImageryLayer } from "cesium";
import { FC } from "react";
import { useCesium } from "resium";

const roadmapLayer = await ImageryLayer.fromProviderAsync(
  Google2DImageryProvider.fromIonAssetId({
    assetId: 3830183,
    mapType: "roadmap",
  }),
);

const overlay = await ImageryLayer.fromProviderAsync(
  Google2DImageryProvider.fromIonAssetId({
    assetId: 3830183,
    overlayLayerType: "layerRoadmap",
  }),
);

// const provider = await IonImageryProvider.fromAssetId(3830184);

export const Events: FC = () => {
  const viewer = useCesium().viewer;

  if (viewer) {
    viewer.imageryLayers.add(roadmapLayer);
    viewer.imageryLayers.add(overlay);
    // viewer.imageryLayers.addImageryProvider(provider);

    viewer.scene.camera.flyTo({
      duration: 0,
      destination: Cartesian3.fromDegrees(35.5727, 33.2076, 150000),
    });
  }

  return null;
};
