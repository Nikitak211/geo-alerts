import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { GeoJSON } from "../types/alert";
import type { CityRow } from "../types/place";
import { buildLookupKeys, toBaseMunicipalityName } from "../utils/cityNameMatching";
import { buildFeaturesByCity, type FeaturesByCityResult } from "../utils/featuresByCity";

type GeoJsonContextValue = {
  /** City display name -> GeoJSON features. */
  featuresByCity: Map<string, GeoJSON.Feature[]>;
  /** Lookup key -> display names (for highlight). */
  placeIndexByCityKey: Map<string, string[]>;
  /** Filtered cities from cities.json. */
  cities: CityRow[];
  /** Resolve city name (from alert) to display names. */
  getDisplayNamesForCity: (cityNameRaw: string) => string[];
};

const GeoJsonContext = createContext<GeoJsonContextValue | null>(null);

export function GeoJsonProvider({
  citiesUrl,
  geojsonUrl,
  children,
}: {
  citiesUrl: string;
  geojsonUrl: string;
  children: ReactNode;
}) {
  const [value, setValue] = useState<FeaturesByCityResult | null>(null);

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
        const features: GeoJSON.Feature[] = Array.isArray(geoData?.features)
          ? geoData.features
          : [];
        if (cancelled) return;
        const result = buildFeaturesByCity(cityRows, features);
        if (!cancelled) setValue(result);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [citiesUrl, geojsonUrl]);

  const getDisplayNamesForCity = useCallback(
    (cityNameRaw: string): string[] => {
      if (!value) return [];
      const { placeIndexByCityKey } = value;
      const trimmed = cityNameRaw.trim();
      const keys = [
        ...buildLookupKeys(cityNameRaw),
        ...buildLookupKeys(toBaseMunicipalityName(cityNameRaw)),
      ].sort((a, b) => b.length - a.length);
      const seen = new Set<string>();
      for (const k of keys) {
        const names = placeIndexByCityKey.get(k) ?? [];
        if (names.length === 0) continue;
        if (trimmed.length > 0 && k.length < trimmed.length * 0.5) continue;
        names.forEach((n) => seen.add(n));
        break;
      }
      return Array.from(seen);
    },
    [value],
  );

  const contextValue: GeoJsonContextValue = value
    ? {
        featuresByCity: value.featuresByCity,
        placeIndexByCityKey: value.placeIndexByCityKey,
        cities: value.cities,
        getDisplayNamesForCity,
      }
    : {
        featuresByCity: new Map(),
        placeIndexByCityKey: new Map(),
        cities: [],
        getDisplayNamesForCity: () => [],
      };

  return (
    <GeoJsonContext.Provider value={contextValue}>
      {children}
    </GeoJsonContext.Provider>
  );
}

export function useGeoJsonContext(): GeoJsonContextValue {
  const ctx = useContext(GeoJsonContext);
  if (!ctx)
    throw new Error("useGeoJsonContext must be used within GeoJsonProvider");
  return ctx;
}
