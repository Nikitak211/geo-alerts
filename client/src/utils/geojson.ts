import type { GeoJSON } from "../types/alert";

/** Centroid of a GeoJSON ring [lon, lat][] (in degrees). */
export function ringCentroid(ring: [number, number][]): [number, number] {
  let sumLon = 0,
    sumLat = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    sumLon += ring[i][0];
    sumLat += ring[i][1];
  }
  return [sumLon / n, sumLat / n];
}

/** Squared distance in degrees (avoids sqrt). Threshold ~0.15 deg ≈ 17 km. */
export function distDegSq(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const dlon = lon1 - lon2,
    dlat = lat1 - lat2;
  return dlon * dlon + dlat * dlat;
}

export const SPATIAL_MATCH_THRESHOLD_DEG_SQ = 0.0225; // 0.15^2 ≈ 17 km

const GEOJSON_NAME_KEYS = [
  "MUN_HEB",
  "SHEM_YISHUV",
  "name_he",
  "שם_ישוב",
  "NAME_HE",
  "name",
  "שם",
];

/** Hebrew name from GeoJSON (only if valid Hebrew; file may have encoding issues). */
export function getHebrewNameFromProps(
  props: Record<string, unknown> | undefined,
): string {
  if (!props) return "";
  for (const k of GEOJSON_NAME_KEYS) {
    const v = props[k];
    if (
      typeof v === "string" &&
      v.trim() &&
      /[\u0590-\u05FF]/.test(v)
    )
      return v.trim();
  }
  return "";
}

/** Get display name from GeoJSON feature. Prefer Hebrew if valid, else English. */
export function getNameFromGeoJsonProps(
  props: Record<string, unknown> | undefined,
): string {
  if (!props) return "";
  const he = getHebrewNameFromProps(props);
  if (he) return he;
  const en = (props.MUN_ENG ?? props.SHEM_YISHUV_ENGLISH) as string;
  return typeof en === "string" ? en.trim() : "";
}

/** Outer ring of a GeoJSON Polygon/MultiPolygon feature (lon, lat)[]. */
export function getRingFromGeoJsonFeature(
  feature: GeoJSON.Feature,
): [number, number][] | null {
  const g = feature.geometry as
    | { type?: string; coordinates?: unknown }
    | undefined;
  if (!g?.coordinates) return null;
  if (g.type === "Polygon") {
    const outer = (g.coordinates as [number, number][][])?.[0];
    return outer?.length ? (outer as [number, number][]) : null;
  }
  if (g.type === "MultiPolygon") {
    const firstPoly = (g.coordinates as [number, number][][][])?.[0];
    const outer = firstPoly?.[0];
    return outer?.length ? (outer as [number, number][]) : null;
  }
  return null;
}
