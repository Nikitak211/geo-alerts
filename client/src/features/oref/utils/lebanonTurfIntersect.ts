/**
 * Line–polygon intersection for Lebanon border (trajectory stops at Lebanon).
 */

import { lineIntersect } from "@turf/line-intersect";
import type { Feature, LineString, Polygon, MultiPolygon } from "geojson";
import type { GeoPoint } from "../types/oref.types";
import type { LebanonGeoJsonFeature } from "../hooks/useLebanonBoundary";
import { movePoint } from "./geo";
import { haversineKm } from "./geo";

const RAY_LENGTH_KM = 500;
const MIN_LEBANON_KM = 30;
const MAX_LEBANON_KM = 400;

/**
 * Find the closest point where a ray crosses the Lebanon border (in range 30–400 km).
 */
export function intersectLineWithLebanonPolygons(
  center: GeoPoint,
  bearingDeg: number,
  lebanonFeatures: LebanonGeoJsonFeature[] | null
): GeoPoint | null {
  if (!lebanonFeatures?.length) return null;

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
    if (km >= MIN_LEBANON_KM && km <= MAX_LEBANON_KM && km < closestKm) {
      closestKm = km;
      closest = p;
    }
  }

  for (const feature of lebanonFeatures) {
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
