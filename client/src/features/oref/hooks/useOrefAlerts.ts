/**
 * Hook: subscribe to OREF WebSocket and expose last oref_update + place_positions + server trajectory.
 * Uses shared SignalR connection from context when available so server broadcasts are received.
 */

import { useEffect, useRef, useState } from "react";
import { HubConnectionState } from "@microsoft/signalr";
import { createOrefSocket } from "../services/orefSocket";
import { OrefEventTypes } from "../constants/alertTypes";
import type { RawOrefPayload } from "../utils/alertNormalization";
import type { GeoBox } from "../../../types";
import { useSignalRConnection } from "../../../contexts/SignalRConnectionContext";

/** Server (screenshot) trajectory for one alert; used on main map when impact is south. */
export type ServerTrajectory = {
  polyline: [number, number][];
  trajectoryTarget: "iran" | "lebanon";
};

export type UseOrefAlertsResult = {
  lastUpdate: RawOrefPayload | null;
  serverPositions: Record<string, GeoBox>;
  connected: boolean;
  /** By alert id; use for main map when centroid is south. */
  serverTrajectoryByAlertId: Record<string, ServerTrajectory>;
};

function normalizeRaw(raw: { type?: string; Type?: string; payload?: unknown; Payload?: unknown }) {
  const type = raw.type ?? raw.Type;
  const payload = raw.payload ?? raw.Payload;
  return { type, payload };
}

export function useOrefAlerts(wsUrl?: string): UseOrefAlertsResult {
  const [lastUpdate, setLastUpdate] = useState<RawOrefPayload | null>(null);
  const [serverPositions, setServerPositions] = useState<Record<string, GeoBox>>({});
  const [connectedFallback, setConnectedFallback] = useState(false);
  const [serverTrajectoryByAlertId, setServerTrajectoryByAlertId] = useState<Record<string, ServerTrajectory>>({});
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const signalR = useSignalRConnection();

  const connected = signalR
    ? signalR.connectionState === HubConnectionState.Connected
    : connectedFallback;

  useEffect(() => {
    const connection = signalR?.connection;
    if (connection) {
      const handler = (raw: { type?: string; Type?: string; payload?: unknown; Payload?: unknown }) => {
        const { type, payload } = normalizeRaw(raw);
        try {
          if (type === OrefEventTypes.OrefUpdate && payload != null) {
            setLastUpdate(payload as RawOrefPayload);
          } else if (
            type === OrefEventTypes.PlacePositions &&
            payload != null &&
            typeof payload === "object"
          ) {
            const p = payload as Record<string, GeoBox> | GeoBox[];
            const record: Record<string, GeoBox> = Array.isArray(p)
              ? Object.fromEntries(
                  p
                    .filter((b): b is GeoBox => b != null && typeof (b as GeoBox).place === "string")
                    .map((b) => [String((b as GeoBox).place), b as GeoBox])
                )
              : (p as Record<string, GeoBox>);
            setServerPositions(() => ({ ...record }));
          } else if (type === OrefEventTypes.InferenceResult && payload != null && typeof payload === "object") {
            const pl = payload as { trajectoryPolyline?: [number, number][]; trajectoryTarget?: "iran" | "lebanon"; alertSummary?: { id: string } };
            if (pl.trajectoryPolyline?.length && pl.alertSummary?.id) {
              setServerTrajectoryByAlertId((prev) => ({
                ...prev,
                [pl.alertSummary!.id]: {
                  polyline: pl.trajectoryPolyline!,
                  trajectoryTarget: pl.trajectoryTarget ?? "iran",
                },
              }));
            }
          }
        } catch {
          // ignore
        }
      };
      connection.on("message", handler);
      return () => {
        connection.off("message", handler);
      };
    }

    unsubscribeRef.current = createOrefSocket(
      {
        onMessage: (msg) => {
          if (msg.type === OrefEventTypes.OrefUpdate && msg.payload) {
            setLastUpdate(msg.payload);
          } else if (msg.type === OrefEventTypes.PlacePositions && msg.payload) {
            setServerPositions(() => ({ ...msg.payload }));
          } else if (msg.type === OrefEventTypes.InferenceResult && msg.payload?.trajectoryPolyline?.length) {
            const id = msg.payload.alertSummary?.id;
            if (id) {
              setServerTrajectoryByAlertId((prev) => ({
                ...prev,
                [id]: {
                  polyline: msg.payload.trajectoryPolyline!,
                  trajectoryTarget: msg.payload.trajectoryTarget ?? "iran",
                },
              }));
            }
          }
        },
        onOpen: () => setConnectedFallback(true),
        onClose: () => setConnectedFallback(false),
      },
      wsUrl
    );
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [wsUrl, signalR?.connection]);

  return { lastUpdate, serverPositions, connected, serverTrajectoryByAlertId };
}
