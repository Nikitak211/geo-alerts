/**
 * Alert ingestion: OrefSocketService connects to WebSocket and emits typed alerts.
 */

import { HubConnectionBuilder, HubConnection, HttpTransportType, LogLevel } from "@microsoft/signalr";
import { OrefEventTypes } from "../constants/alertTypes";
import type { RawOrefPayload } from "../utils/alertNormalization";
import type { GeoBox } from "../../../types";

/** Enriched inference payload from server (cluster, corridor, top candidates, optional trajectory). */
export interface InferenceBroadcastPayload {
  alertSummary: { id: string; title: string; receivedAt: string; category: string; settlementCount: number };
  cluster: unknown;
  corridor: unknown;
  topCandidates: Array<{ candidateId: string; name: string; rank: number; score: number; confidence: number }>;
  confidence: "high" | "medium" | "low";
  algorithmVersion: string;
  /** Server (screenshot) trajectory; use on main map when impact is south. */
  trajectoryPolyline?: [number, number][];
  trajectoryTarget?: "iran" | "lebanon";
}

export type OrefSocketMessage =
  | { type: typeof OrefEventTypes.OrefUpdate; payload: RawOrefPayload }
  | { type: typeof OrefEventTypes.PlacePositions; payload: Record<string, GeoBox> }
  | { type: typeof OrefEventTypes.Hello; payload?: undefined }
  | { type: typeof OrefEventTypes.InferenceResult; payload: InferenceBroadcastPayload };

export type OrefSocketCallbacks = {
  onMessage: (msg: OrefSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

/**
 * Connect to OREF WebSocket; returns unsubscribe function.
 * @param url - Optional; defaults to same-origin /ws.
 */
export function createOrefSocket(
  callbacks: OrefSocketCallbacks,
  url?: string
): () => void {
  const baseUrl =
    url ??
    (typeof window !== "undefined"
      ? `${window.location.origin}/ws`
      : "http://localhost:5206/ws");

  const connection: HubConnection = new HubConnectionBuilder()
    .withUrl(baseUrl, {
      transport: HttpTransportType.WebSockets,
      skipNegotiation: true,
    })
    .withServerTimeout(600000)
    .withKeepAliveInterval(5000)
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Information)
    .build();

  const cbs = callbacks;

  connection.on("message", (raw: { type?: string; payload?: unknown }) => {
    try {
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
        const payload = raw.payload as Record<string, GeoBox> | GeoBox[];
        const record: Record<string, GeoBox> = Array.isArray(payload)
          ? Object.fromEntries(
              payload
                .filter((b): b is GeoBox => b != null && typeof (b as GeoBox).place === "string")
                .map((b) => [String((b as GeoBox).place), b as GeoBox])
            )
          : (payload as Record<string, GeoBox>);
        cbs.onMessage({
          type: OrefEventTypes.PlacePositions,
          payload: record,
        });
      } else if (raw.type === OrefEventTypes.Hello) {
        cbs.onMessage({ type: OrefEventTypes.Hello });
      } else if (raw.type === OrefEventTypes.InferenceResult && raw.payload != null && typeof raw.payload === "object") {
        cbs.onMessage({
          type: OrefEventTypes.InferenceResult,
          payload: raw.payload as InferenceBroadcastPayload,
        });
      }
    } catch {
      // ignore
    }
  });

  (async () => {
    try {
      await connection.start();
      cbs.onOpen?.();
    } catch (e) {
      console.error("Failed to start Oref SignalR connection", e);
      cbs.onClose?.();
    }
  })();

  return () => {
    void connection.stop();
  };
}
