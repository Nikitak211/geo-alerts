/**
 * Source corridor / border proximity: candidate gates for Lebanon and Iran approach directions.
 * Used to stop the stretched trajectory line at border-entry proximity.
 */

import type { LonLat } from "./geo";
import type { TrajectorySource } from "../types/oref.types";
import { bearing, haversineKm, movePoint } from "./geo";

export type BorderGate = {
  id: TrajectorySource;
  /** Gate center [lon, lat]. */
  point: LonLat;
  /** Approximate approach bearing (degrees) from this gate toward Israel. */
  approachBearing: number;
};

/** Iran only: Sanandaj (western Iran) as sole trajectory start for 10+ alerts. */
export const BORDER_GATES: BorderGate[] = [
  {
    id: "iran",
    point: [46.99, 35.31],
    approachBearing: 265,
  },
];

/** Max trajectory length so ray can reach Iran border (~1200–1800 km from Israel). */
const MAX_EXTEND_KM = 2000;

/**
 * From impact centroid, move toward the gate (Iran/Lebanon border).
 * bearingDeg = bearing FROM gate TO centroid (incoming); we move centroid → gate so use (bearingDeg + 180).
 */
export function getBackProjectedEnd(
  from: LonLat,
  bearingDeg: number,
  distanceKm: number
): LonLat {
  const d = Math.min(distanceKm, MAX_EXTEND_KM);
  return movePoint(from, (bearingDeg + 180) % 360, d);
}

/**
 * Choose best-matching corridor (Lebanon vs Iran) by comparing line bearing to gate approach.
 * Returns gate id and full distance to that gate so the trajectory starts at the border.
 */
export function chooseCorridorAndDistance(
  centroid: LonLat,
  incomingBearingDeg: number
): { source: TrajectorySource; distanceKm: number } {
  let best = { source: "unknown" as TrajectorySource, distanceKm: MAX_EXTEND_KM };
  let bestScore = -1;

  for (const gate of BORDER_GATES) {
    const gateBearingFromCentroid = bearing(centroid, gate.point);
    const approachBearing = gate.approachBearing;
    const diff = Math.abs(
      ((gateBearingFromCentroid - approachBearing + 180) % 360) - 180
    );
    const score = 180 - diff;
    if (score > bestScore) {
      bestScore = score;
      const dist = haversineKm(centroid, gate.point);
      best = {
        source: gate.id,
        distanceKm: Math.min(dist, MAX_EXTEND_KM),
      };
    }
  }

  return best;
}
