import type { GeoJSON } from "../types/alert";
import type { CityRow } from "../types/place";
import { buildLookupKeys, normalize, normalizeEnglish } from "./cityNameMatching";
import {
  distDegSq,
  getHebrewNameFromProps,
  getRingFromGeoJsonFeature,
  ringCentroid,
  SPATIAL_MATCH_THRESHOLD_DEG_SQ,
} from "./geojson";

export type FeaturesByCityResult = {
  /** Map of city display name (Hebrew) -> GeoJSON features for that city. */
  featuresByCity: Map<string, GeoJSON.Feature[]>;
  /** Map of lookup key -> display names (for highlight name resolution). */
  placeIndexByCityKey: Map<string, string[]>;
  /** Filtered cities from cities.json (no "Select All", has coords where needed). */
  cities: CityRow[];
};

/** Build featuresByCity and placeIndexByCityKey from cities.json + GeoJSON. */
export function buildFeaturesByCity(
  cityRows: CityRow[],
  features: GeoJSON.Feature[],
): FeaturesByCityResult {
  const cityLookupKeys = new Set<string>();
  const cityEnglishKeys = new Set<string>();
  const cityEnglishToHebrew = new Map<string, string>();
  const citiesWithCoords: { lat: number; lng: number; name: string }[] = [];
  const cities: CityRow[] = [];

  for (const row of cityRows) {
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    const value =
      typeof row?.value === "string" ? row.value.trim() : name;
    const nameEn =
      typeof row?.name_en === "string" ? row.name_en.trim() : "";
    if (!name || value === "all") continue;
    const lat = Number(row?.lat),
      lng = Number(row?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      citiesWithCoords.push({ lat, lng, name });
    }
    cities.push(row);
    for (const key of buildLookupKeys(name)) {
      cityLookupKeys.add(key);
    }
    if (value && value !== name) {
      for (const key of buildLookupKeys(value)) {
        cityLookupKeys.add(key);
      }
    }
    for (const part of name.split(",").map((s) => s.trim()).filter(Boolean)) {
      for (const key of buildLookupKeys(part)) {
        cityLookupKeys.add(key);
      }
    }
    if (nameEn) {
      const normEn = normalizeEnglish(nameEn);
      cityEnglishKeys.add(normEn);
      cityEnglishToHebrew.set(normEn, name);
    }
  }

  const featuresByCity = new Map<string, GeoJSON.Feature[]>();
  const placeIndexByCityKey = new Map<string, string[]>();

  for (const feature of features) {
    const ring = getRingFromGeoJsonFeature(feature);
    if (!ring || ring.length < 3) continue;
    let closedRing = ring;
    if (
      ring[0][0] !== ring[ring.length - 1][0] ||
      ring[0][1] !== ring[ring.length - 1][1]
    ) {
      closedRing = [...ring, [ring[0][0], ring[0][1]]];
    }
    const props = feature.properties ?? {};
    const nameHebrew = getHebrewNameFromProps(props);
    const nameEnglish =
      typeof props.MUN_ENG === "string"
        ? props.MUN_ENG.trim()
        : typeof props.SHEM_YISHUV_ENGLISH === "string"
          ? props.SHEM_YISHUV_ENGLISH.trim()
          : "";
    const name = nameHebrew || nameEnglish;
    const featureKeys = name ? buildLookupKeys(name) : [];
    const normEn = normalizeEnglish(nameEnglish);
    let displayName: string;
    let matched = false;
    const isNameMatched =
      !!name &&
      (featureKeys.some((k) => cityLookupKeys.has(k)) ||
        (normEn && cityEnglishKeys.has(normEn)));
    if (isNameMatched) {
      displayName = cityEnglishToHebrew.get(normEn) || name;
      matched = true;
    } else {
      const [lon, lat] = ringCentroid(closedRing);
      let bestSq = SPATIAL_MATCH_THRESHOLD_DEG_SQ;
      let bestCity: { name: string } | null = null;
      for (const city of citiesWithCoords) {
        const d = distDegSq(lon, lat, city.lng, city.lat);
        if (d < bestSq) {
          bestSq = d;
          bestCity = city;
        }
      }
      if (bestCity) {
        displayName = bestCity.name;
        matched = true;
      } else {
        continue;
      }
    }
    const arr = featuresByCity.get(displayName) ?? [];
    arr.push(feature);
    featuresByCity.set(displayName, arr);
    const allKeys = new Set(buildLookupKeys(displayName));
    if (
      matched &&
      normEn &&
      cityEnglishToHebrew.has(normEn) &&
      featureKeys.length
    ) {
      featureKeys.forEach((k) => allKeys.add(k));
    }
    if (nameHebrew) {
      buildLookupKeys(nameHebrew).forEach((k) => allKeys.add(k));
    }
    // For alert highlighting we only want name-based matches: a polygon is highlighted
    // when its actual MUN_HEB matches an alert name. When a feature is spatially matched
    // (assigned displayName by centroid), do NOT index it under displayName's keys —
    // only under its actual name (nameHebrew). So getDisplayNamesForCity("קריית שמונה")
    // won't return "מרגליות", and we won't highlight the wrong polygon.
    const namesToIndex = new Set<string>();
    let keysForIndex = allKeys;
    if (isNameMatched) {
      namesToIndex.add(displayName);
      if (nameHebrew && nameHebrew !== displayName) {
        namesToIndex.add(nameHebrew);
      }
    } else {
      if (nameHebrew) {
        namesToIndex.add(nameHebrew);
        keysForIndex = new Set(buildLookupKeys(nameHebrew));
      } else {
        namesToIndex.add(displayName);
        keysForIndex = new Set(buildLookupKeys(displayName));
      }
    }
    for (const key of keysForIndex) {
      // Don't index under the normalized (geresh-stripped) form of our name when it would
      // collapse two distinct places: e.g. ג'ת (Jatt) must not be findable by "גת", so alerts
      // for "גת" (Gat) don't highlight Jatt.
      if (nameHebrew && key === normalize(nameHebrew) && key !== nameHebrew) continue;
      const keyArr = placeIndexByCityKey.get(key) ?? [];
      for (const n of namesToIndex) {
        if (!keyArr.includes(n)) keyArr.push(n);
      }
      placeIndexByCityKey.set(key, keyArr);
    }
  }

  return { featuresByCity, placeIndexByCityKey, cities };
}
