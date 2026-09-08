/**
 * Infer approach side / entry side from alert cluster using neutral geometry.
 * "From which side is this alert cluster closest to entering the monitored area?"
 * Uses Turf: centroid, convex hull, nearestPointOnLine.
 */

import { point, featureCollection } from "@turf/helpers";
import centroid from "@turf/centroid";
import convex from "@turf/convex";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import distance from "@turf/distance";
import type { Feature, Point, Polygon } from "geojson";
import type { AlertPlace, ApproachSide, BoundarySet, ProximityResult } from "./proximityTypes";

const SIDES: ApproachSide[] = ["north", "south", "east", "west"];

/**
 * Module-level LRU-style result cache keyed by sorted place coordinates.
 * Boundaries are always static (israelAoiBoundaries), so only the alert cluster
 * determines the result.  Cap at 32 entries to bound memory under sustained alerts.
 */
const PROXIMITY_CACHE_MAX = 32;
const proximityCache = new Map<string, ProximityResult>();

function makeProximityCacheKey(alertPlaces: AlertPlace[]): string {
  return alertPlaces
    .map((p) => `${p.name}:${p.lat.toFixed(4)}:${p.lng.toFixed(4)}`)
    .sort()
    .join("|");
}

/**
 * Solve proximity: map alert places → points, compute center and hull,
 * find nearest boundary side and distance. Returns approach side, not origin country.
 */
export function solveProximity(
  alertPlaces: AlertPlace[],
  boundaries: BoundarySet
): ProximityResult {
  const empty: ProximityResult = {
    center: { lng: 0, lat: 0 },
    hull: null,
    approachSide: "unknown",
    nearestBoundaryDistanceKm: Infinity,
    nearestBoundaryPoint: null,
  };

  if (!alertPlaces.length) return empty;

  const cacheKey = makeProximityCacheKey(alertPlaces);
  const cached = proximityCache.get(cacheKey);
  if (cached) return cached;

  const pts = featureCollection(
    alertPlaces.map((p) => point([p.lng, p.lat], { name: p.name }))
  );

  const centerFeature = centroid(pts as unknown as Feature<Point>);
  const centerCoords = centerFeature.geometry.coordinates;
  const centerLonLat = { lng: centerCoords[0], lat: centerCoords[1] };

  const hullFeature = convex(pts as unknown as Feature<Point>);
  const hull: ProximityResult["hull"] = hullFeature ? (hullFeature as Feature<Polygon>) : null;

  const sides = SIDES.map((side) => {
    const line = boundaries[side as keyof BoundarySet];
    const nearest = nearestPointOnLine(line, centerFeature, { units: "kilometers" });
    const distKm =
      (nearest.properties?.dist as number | undefined) ??
      (nearest.properties?.pointDistance as number | undefined) ??
      distance(centerFeature, nearest, { units: "kilometers" });
    return {
      side,
      distKm,
      nearest,
    };
  });

  sides.sort((a, b) => a.distKm - b.distKm);
  const best = sides[0];

  const result: ProximityResult = {
    center: centerLonLat,
    hull,
    approachSide: best?.side ?? "unknown",
    nearestBoundaryDistanceKm: best?.distKm ?? Infinity,
    nearestBoundaryPoint: best
      ? {
          lng: best.nearest.geometry.coordinates[0],
          lat: best.nearest.geometry.coordinates[1],
        }
      : null,
  };

  if (proximityCache.size >= PROXIMITY_CACHE_MAX) {
    const oldestKey = proximityCache.keys().next().value;
    if (oldestKey !== undefined) proximityCache.delete(oldestKey);
  }
  proximityCache.set(cacheKey, result);
  return result;
}
