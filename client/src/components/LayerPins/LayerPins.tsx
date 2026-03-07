import { FC, memo } from "react";
import { useAlertPlaces } from "../../contexts/AlertPlacesContext";
import { usePlaceGeo } from "../../utils/useOrefGeoBoxes";
import { Pin } from "../Pin";

const PinWithGeo: FC<{
  place: string;
  title: string;
  serverPositions?: Record<string, import("../../types").GeoBox>;
}> = memo(({ place, title, serverPositions }) => {
  const { center } = usePlaceGeo(place, {
    fallbackToWebApi: false,
    serverPositions,
  });
    if (!center) return null;
    return <Pin center={center} title={title} />;
  },
);
PinWithGeo.displayName = "PinWithGeo";

export const LayerPins: FC = memo(() => {
  const { places, serverPositions, clearAll } = useAlertPlaces();

  return (
    <>
      {places.map(({ place, title }, i) => (
        <PinWithGeo
          key={`${place}-${title}-${i}`}
          place={place}
          title={title}
          serverPositions={serverPositions}
        />
      ))}
      {places.length > 0 && (
        <button
          style={{
            position: "absolute",
            bottom: 0,
          }}
          onClick={clearAll}
          type="button"
        >
          Clear All Pins
        </button>
      )}
    </>
  );
});

LayerPins.displayName = "LayerPins";
