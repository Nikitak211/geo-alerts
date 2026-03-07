/**
 * Load Iran bases from public/data/ir_bases.json for trajectory source matching.
 */

import { useEffect, useState } from "react";
import type { GeoPoint } from "../types/oref.types";

const IR_BASES_URL = "/data/ir_bases.json";

export function useIrBases(): GeoPoint[] {
  const [points, setPoints] = useState<GeoPoint[]>([]);

  useEffect(() => {
    fetch(IR_BASES_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { features?: Array<{ geometry?: { coordinates?: [number, number] } }> } | null) => {
        if (!data?.features?.length) return;
        const coords: GeoPoint[] = [];
        for (const f of data.features) {
          const c = f?.geometry?.coordinates;
          if (Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
            coords.push([c[0], c[1]]);
          }
        }
        setPoints(coords);
      })
      .catch(() => {});
  }, []);

  return points;
}
