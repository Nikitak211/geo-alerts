/**
 * Trajectory eligibility: only certain alerts generate a path.
 * - type === "oref_update"
 * - title === "ירי רקטות וטילים"
 * - at least 10 valid areas (fewer than 10 → no trajectory; 10+ → use all for direction fit).
 */

import { ROCKET_ALERT_TITLE } from "../constants/alertTypes";
import type { OrefNormalizedAlert, OrefArea, OrefAlert } from "../types/oref.types";

const MIN_AREA_COUNT = 10;

function isValidPoint(lon: number, lat: number): boolean {
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    !(lat === 0 && lon === 0)
  );
}

/** Filter out place name that should be ignored (e.g. "all"). */
function isPlaceIgnored(name: string): boolean {
  const v = (name || "").trim().toLowerCase();
  return v === "all" || v === "";
}

/**
 * Returns true if this normalized alert should generate a trajectory.
 */
export function isEligibleForTrajectory(alert: OrefNormalizedAlert): boolean {
  if (alert.title !== ROCKET_ALERT_TITLE) return false;
  if (!alert.data?.length || !alert.positions?.length) return false;

  const validAreas: OrefArea[] = [];
  for (let i = 0; i < alert.data.length; i++) {
    const name = alert.data[i];
    if (isPlaceIgnored(name)) continue;
    const [lon, lat] = alert.positions[i] ?? [0, 0];
    if (!isValidPoint(lon, lat)) continue;
    validAreas.push({ name, point: [lon, lat] });
  }

  return validAreas.length >= MIN_AREA_COUNT;
}

/**
 * Build typed OrefAlert with all valid areas (10 or more) for trajectory (call only when isEligibleForTrajectory true).
 */
export function toEligibleAlert(normalized: OrefNormalizedAlert): OrefAlert | null {
  const areas: OrefArea[] = [];
  for (let i = 0; i < normalized.data.length; i++) {
    const name = normalized.data[i];
    if (isPlaceIgnored(name)) continue;
    const [lon, lat] = normalized.positions[i] ?? [0, 0];
    if (!isValidPoint(lon, lat)) continue;
    areas.push({ name, point: [lon, lat] });
  }
  if (areas.length < MIN_AREA_COUNT) return null;

  return {
    id: normalized.id,
    title: normalized.title,
    data: normalized.data,
    areas,
    time: normalized.time,
  };
}
