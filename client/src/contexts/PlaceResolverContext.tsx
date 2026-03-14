/**
 * Resolves OREF place names to lat/lon so trajectory can run when server doesn't send place_positions (e.g. mock).
 * Uses same cities.json + municipalities.geojson as GeoJsonProvider.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CityRow } from "../types/place";
import { buildFeaturesByCity } from "../utils/featuresByCity";
import { buildLookupKeys, toBaseMunicipalityName } from "../utils/cityNameMatching";
import { getRingFromGeoJsonFeature, ringCentroid } from "../utils/geojson";
import type { GeoJSON } from "../types/alert";

export type GetCenterForPlace = (placeName: string) => { lat: number; lon: number } | null;

type PlaceResolverContextValue = {
  getCenterForPlace: GetCenterForPlace;
  ready: boolean;
};

const PlaceResolverContext = createContext<PlaceResolverContextValue | null>(null);

export function usePlaceResolver(): PlaceResolverContextValue | null {
  return useContext(PlaceResolverContext);
}

export function PlaceResolverProvider({
  children,
  citiesUrl = "/data/cities.json",
  geojsonUrl = "/data/municipalities.geojson",
}: {
  children: ReactNode;
  citiesUrl?: string;
  geojsonUrl?: string;
}) {
  const [result, setResult] = useState<{
    featuresByCity: Map<string, GeoJSON.Feature[]>;
    placeIndexByCityKey: Map<string, string[]>;
    cities: CityRow[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [citiesRes, geoRes] = await Promise.all([
          fetch(citiesUrl, { headers: { Accept: "application/json" } }),
          fetch(geojsonUrl, { headers: { Accept: "application/json" } }),
        ]);
        if (!citiesRes.ok || !geoRes.ok || cancelled) return;
        const citiesData = await citiesRes.json();
        const geoData = await geoRes.json();
        const cityRows: CityRow[] = Array.isArray(citiesData) ? citiesData : [];
        const features: GeoJSON.Feature[] = Array.isArray(geoData?.features) ? geoData.features : [];
        if (cancelled) return;
        const build = buildFeaturesByCity(cityRows, features);
        if (!cancelled) setResult(build);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [citiesUrl, geojsonUrl]);

  const getCenterForPlace = useCallback<GetCenterForPlace>(
    (placeName: string) => {
      if (!result) return null;
      const trimmed = (placeName || "").trim();
      if (!trimmed) return null;
      const { featuresByCity, placeIndexByCityKey, cities } = result;

      // Try cities.json lat/lng first
      for (const row of cities) {
        const name = typeof row.name === "string" ? row.name.trim() : "";
        const value = typeof row.value === "string" ? row.value.trim() : "";
        if (name === trimmed || value === trimmed) {
          const lat = Number(row.lat);
          const lng = Number(row.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lon: lng };
        }
      }

      // Try GeoJSON: lookup key -> display names -> first feature centroid
      const keys = [
        ...buildLookupKeys(trimmed),
        ...buildLookupKeys(toBaseMunicipalityName(trimmed)),
      ].sort((a, b) => b.length - a.length);
      for (const key of keys) {
        const displayNames = placeIndexByCityKey.get(key) ?? [];
        for (const displayName of displayNames) {
          const feats = featuresByCity.get(displayName);
          const feature = feats?.[0];
          if (!feature) continue;
          const ring = getRingFromGeoJsonFeature(feature);
          if (!ring || ring.length < 3) continue;
          const [lon, lat] = ringCentroid(ring);
          if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
        }
      }
      return null;
    },
    [result]
  );

  const value = useMemo<PlaceResolverContextValue>(
    () => ({
      getCenterForPlace,
      ready: result != null,
    }),
    [getCenterForPlace, result]
  );

  return (
    <PlaceResolverContext.Provider value={value}>
      {children}
    </PlaceResolverContext.Provider>
  );
}
