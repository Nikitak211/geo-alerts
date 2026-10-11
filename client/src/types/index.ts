export type { PlaceData, CityRow } from "./place";
export type { AlertPayload, HighlightStore } from "./alert";

export type OrefAlert = {
  id: string;
  cat: string;
  title: string;
  data: string[]; // location names in Hebrew
  desc: string;
};

export type GeoBox = {
  place: string;
  bbox: [number, number, number, number]; // [south, north, west, east]
  center: { lat: number; lon: number };
  displayName?: string;
  title: string;
};

export type SelectedArea = {
  areaHeb: string;
  entityId: string;
};
