/**
 * Load Iran border from public/data/ir.json for trajectory boundary intersection and map layer.
 */

import { useEffect, useState } from "react";
import { parseIranGeoJson } from "../utils/iranBoundary";
import type { BoundarySegment } from "../utils/iranBoundary";

const IRAN_GEOJSON_URL = "/data/ir.json";

export type IranGeoJsonFeature = {
  type: string;
  geometry?: { type: string; coordinates: unknown };
};

export type IranBoundaryState = {
  segments: BoundarySegment[];
  geojson: IranGeoJsonFeature[] | null;
};

export function useIranBoundary(): IranBoundaryState {
  const [segments, setSegments] = useState<BoundarySegment[]>([]);
  const [geojson, setGeojson] = useState<IranGeoJsonFeature[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(IRAN_GEOJSON_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { type?: string; features?: IranGeoJsonFeature[] } | null) => {
        if (cancelled || !data) return;
        const parsed = parseIranGeoJson(data);
        if (parsed.length) setSegments(parsed);
        if (Array.isArray(data.features) && data.features.length) {
          setGeojson(data.features);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return { segments, geojson };
}
