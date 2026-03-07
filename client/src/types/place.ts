/** Place/city data for polygon layer (from cities.json + GeoJSON). */
export type PlaceData = {
  displayName: string;
  coordinates: [number, number][];
};

/** Row from cities.json. */
export type CityRow = {
  id?: number;
  name?: string;
  name_en?: string;
  value?: string;
  lat?: number;
  lng?: number;
};
