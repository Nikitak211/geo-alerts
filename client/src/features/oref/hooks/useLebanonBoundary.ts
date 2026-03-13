/**
 * Load Lebanon border from public/data/lb.json for trajectory (when trajectory points to Lebanon).
 */

import { useEffect, useState } from "react";

const LEBANON_GEOJSON_URL = "/data/lb.json";

export type LebanonGeoJsonFeature = {
  type: string;
  geometry?: { type: string; coordinates: unknown };
};

export type LebanonBoundaryState = {
  geojson: LebanonGeoJsonFeature[] | null;
};

export function useLebanonBoundary(): LebanonBoundaryState {
  const [geojson, setGeojson] = useState<LebanonGeoJsonFeature[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(LEBANON_GEOJSON_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { type?: string; features?: LebanonGeoJsonFeature[] } | null) => {
        if (cancelled || !data) return;
        if (Array.isArray(data.features) && data.features.length) {
          setGeojson(data.features);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return { geojson };
}
