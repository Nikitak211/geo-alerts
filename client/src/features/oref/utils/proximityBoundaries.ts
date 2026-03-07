/**
 * Default AOI boundaries: Israel approximate bounding box (neutral geometry).
 * Edges as LineStrings for nearest-point-on-line. [lng, lat] per GeoJSON.
 */

import type { Feature, LineString } from "geojson";
import type { BoundarySet } from "./proximityTypes";

const LNG_W = 34.2;
const LNG_E = 35.9;
const LAT_S = 29.5;
const LAT_N = 33.4;

function line(coords: [number, number][]): Feature<LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
}

/** Israel AOI: north, south, east, west edges. */
export const israelAoiBoundaries: BoundarySet = {
  north: line([
    [LNG_W, LAT_N],
    [LNG_E, LAT_N],
  ]),
  south: line([
    [LNG_W, LAT_S],
    [LNG_E, LAT_S],
  ]),
  east: line([
    [LNG_E, LAT_S],
    [LNG_E, LAT_N],
  ]),
  west: line([
    [LNG_W, LAT_S],
    [LNG_W, LAT_N],
  ]),
};
