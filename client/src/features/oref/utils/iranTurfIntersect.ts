/**
 * 2D line–polygon intersection using Turf.js so the trajectory stops exactly at the Iran border.
 * Builds a ray (line segment from center toward Iran) and finds the closest crossing with Iran polygon(s).
 */

import { lineIntersect } from "@turf/line-intersect";
import type { Feature, LineString, Polygon, MultiPolygon } from "geojson";
import type { GeoPoint } from "../types/oref.types";
import type { IranGeoJsonFeature } from "../hooks/useIranBoundary";
import { movePoint } from "./geo";
import { haversineKm } from "./geo";

/** Line length (km) from center so the segment definitely crosses Iran. */
const RAY_LENGTH_KM = 2500;

/** Only accept crossings in this range (km) so we get the western Iraq–Iran border, not far side. */
const MIN_CROSSING_KM = 400;
const MAX_CROSSING_KM = 1600;

/**
 * Find the closest point where a ray (from center in bearing direction) crosses the Iran border.
 * Uses Turf lineIntersect; only accepts crossings in [MIN_CROSSING_KM, MAX_CROSSING_KM] so the
 * line stops at the western border (Iraq–Iran), not inside Iran or at the far side.
 */
export function intersectLineWithIranPolygons(
  center: GeoPoint,
  bearingDeg: number,
  iranFeatures: IranGeoJsonFeature[] | null
): GeoPoint | null {
  if (!iranFeatures?.length) return null;

  const end = movePoint(center, bearingDeg, RAY_LENGTH_KM);
  const line: Feature<LineString> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [center, end],
    },
  };

  let closest: GeoPoint | null = null;
  let closestKm = Infinity;

  function consider(p: GeoPoint) {
    const km = haversineKm(center, p);
    if (km >= MIN_CROSSING_KM && km <= MAX_CROSSING_KM && km < closestKm) {
      closestKm = km;
      closest = p;
    }
  }

  for (const feature of iranFeatures) {
    const geom = feature?.geometry;
    if (!geom?.coordinates) continue;

    if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
      const polygon: Feature<Polygon> = {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: geom.coordinates as Polygon["coordinates"] },
      };
      const fc = lineIntersect(line, polygon);
      for (const f of fc.features) {
        const coords = f.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          consider([coords[0], coords[1]]);
        }
      }
    } else if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
      for (const polygonCoords of geom.coordinates as MultiPolygon["coordinates"]) {
        const polygon: Feature<Polygon> = {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: polygonCoords },
        };
        const fc = lineIntersect(line, polygon);
        for (const f of fc.features) {
          const coords = f.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            consider([coords[0], coords[1]]);
          }
        }
      }
    }
  }

  return closest;
}
