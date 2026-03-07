import { FC, memo } from "react";
import { LayerPolygon } from "./LayerPolygon";
import type { CityRow } from "../../types";

type PlacesPolygonLayerProps = {
  cities: CityRow[];
  highlightedNames: Set<string>;
};

export const PlacesPolygonLayer: FC<PlacesPolygonLayerProps> = memo(({
  cities,
  highlightedNames,
}) => {
  return (
    <>
      {cities.map((city, i) => (
        <LayerPolygon
          key={`${city.name ?? ""}-${city.id ?? i}-${i}`}
          city={city}
          highlighted={highlightedNames.has(city.name ?? "")}
        />
      ))}
    </>
  );
});
PlacesPolygonLayer.displayName = "PlacesPolygonLayer";
