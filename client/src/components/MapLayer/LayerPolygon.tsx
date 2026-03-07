import { FC, memo, useMemo } from "react";
import type { GeoJSON } from "../../types/alert";
import type { CityRow } from "../../types";
import { useGeoJsonContext } from "../../contexts/GeoJsonContext";
import { getRingFromGeoJsonFeature } from "../../utils/geojson";
import { SinglePolygon } from "./SinglePolygon";
import { v4 } from "uuid";

type LayerPolygonProps = {
  city: CityRow;
  highlighted: boolean;
};

/** Extracts coordinates from a GeoJSON feature, ensuring closed ring. */
function getClosedRing(feature: GeoJSON.Feature): [number, number][] | null {
  const ring = getRingFromGeoJsonFeature(feature);
  if (!ring || ring.length < 3) return null;
  if (
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
  ) {
    return ring;
  }
  return [...ring, [ring[0][0], ring[0][1]]];
}

export const LayerPolygon: FC<LayerPolygonProps> = memo(
  ({ city, highlighted }) => {
    const { featuresByCity } = useGeoJsonContext();
    const displayName = city.name ?? "";

    const polygons = useMemo(() => {
      const features = featuresByCity.get(displayName) ?? [];
      return features
        .map((f) => {
          const ring = getClosedRing(f);
          if (!ring) return null;
          return { displayName, coordinates: ring };
        })
        .filter(
          (p): p is { displayName: string; coordinates: [number, number][] } =>
            p !== null,
        );
    }, [featuresByCity, displayName]);

    if (!displayName || polygons.length === 0) return null;

    return (
      <>
        {polygons.map((p, i) => (
          <SinglePolygon
            key={v4()}
            displayName={p.displayName}
            coordinates={p.coordinates}
            highlighted={highlighted}
          />
        ))}
      </>
    );
  },
);
LayerPolygon.displayName = "LayerPolygon";
