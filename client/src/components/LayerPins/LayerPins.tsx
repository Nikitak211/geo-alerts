import { FC, memo } from "react";
import { useOrefGeoBoxes } from "../../utils/useOrefGeoBoxes";
import { Pin } from "../Pin";
import { v4 } from "uuid";

export const LayerPins: FC = memo(() => {
  const { geoBoxes, clearAll } = useOrefGeoBoxes("ws://localhost:8080");

  return (
    <>
      {geoBoxes.map((box) => {
        return <Pin key={v4()} center={box.center} title={box.title} />;
      })}
      <button
        style={{
          position: "absolute",
          bottom: 0,
        }}
        onClick={clearAll}
        type="button"
      >
        clear All Pins
      </button>
    </>
  );
});

LayerPins.displayName = "LayerPins";
