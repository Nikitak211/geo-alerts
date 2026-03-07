/**
 * Alert ingestion: OrefSocketService connects to WebSocket and emits typed alerts.
 */

import { getWsUrl } from "../../../utils/helper";
import { OrefEventTypes } from "../constants/alertTypes";
import type { RawOrefPayload } from "../utils/alertNormalization";
import type { GeoBox } from "../../../types";

export type OrefSocketMessage =
  | { type: typeof OrefEventTypes.OrefUpdate; payload: RawOrefPayload }
  | { type: typeof OrefEventTypes.PlacePositions; payload: Record<string, GeoBox> }
  | { type: typeof OrefEventTypes.Hello; payload?: undefined };

export type OrefSocketCallbacks = {
  onMessage: (msg: OrefSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

/**
 * Connect to OREF WebSocket; returns unsubscribe function.
 * @param url - Optional; defaults to getWsUrl().
 */
export function createOrefSocket(
  callbacks: OrefSocketCallbacks,
  url?: string
): () => void {
  const wsUrl = url ?? getWsUrl();
  const cbs = callbacks;

  const ws = new WebSocket(wsUrl);

  ws.onmessage = (ev) => {
    try {
      const raw = JSON.parse(ev.data) as { type?: string; payload?: unknown };
      if (raw.type === OrefEventTypes.OrefUpdate && raw.payload != null) {
        cbs.onMessage({
          type: OrefEventTypes.OrefUpdate,
          payload: raw.payload as RawOrefPayload,
        });
      } else if (
        raw.type === OrefEventTypes.PlacePositions &&
        raw.payload != null &&
        typeof raw.payload === "object"
      ) {
        cbs.onMessage({
          type: OrefEventTypes.PlacePositions,
          payload: raw.payload as Record<string, GeoBox>,
        });
      } else if (raw.type === OrefEventTypes.Hello) {
        cbs.onMessage({ type: OrefEventTypes.Hello });
      }
    } catch {
      // ignore
    }
  };

  ws.onopen = () => cbs.onOpen?.();
  ws.onclose = () => cbs.onClose?.();

  return () => ws.close();
}
