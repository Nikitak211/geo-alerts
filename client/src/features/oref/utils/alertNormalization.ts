/**
 * Alert normalization: safely parse raw WebSocket messages into typed model.
 */

import type { OrefNormalizedAlert } from "../types/oref.types";
import { OrefEventTypes } from "../constants/alertTypes";

export type RawOrefPayload = {
  id?: string | number;
  title?: string;
  data?: string[];
  desc?: string;
  cat?: string;
};

export type RawWsMessage = {
  type?: string;
  payload?: unknown;
  ts?: number;
};

function isInvalidPoint(lon: number, lat: number): boolean {
  return (
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    (lat === 0 && lon === 0)
  );
}

/**
 * Parse raw oref_update payload and optional position map into normalized alert.
 * Positions array order matches data[]; use 0,0 for missing/invalid.
 */
export function normalizeOrefAlert(
  raw: RawOrefPayload,
  positionByPlace: Record<string, { lat: number; lon: number }> = {}
): OrefNormalizedAlert {
  const id = raw?.id != null ? String(raw.id) : "";
  const title = typeof raw?.title === "string" ? raw.title : "";
  const data = Array.isArray(raw?.data) ? raw.data : [];

  const positions: [number, number][] = data.map((name) => {
    const c = positionByPlace[name];
    if (c && Number.isFinite(c.lon) && Number.isFinite(c.lat)) {
      return [c.lon, c.lat];
    }
    return [0, 0];
  });

  return {
    id,
    title,
    data,
    positions,
    time: new Date(),
  };
}

/** Guard: true if message is oref_update with payload. */
export function isOrefUpdateMessage(msg: RawWsMessage): msg is RawWsMessage & { payload: RawOrefPayload } {
  return msg?.type === OrefEventTypes.OrefUpdate && msg?.payload != null && typeof msg.payload === "object";
}
