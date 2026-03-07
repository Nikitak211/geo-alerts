/**
 * Hook: subscribe to OREF WebSocket and expose last oref_update + place_positions + server trajectory.
 */

import { useEffect, useRef, useState } from "react";
import { createOrefSocket } from "../services/orefSocket";
import { OrefEventTypes } from "../constants/alertTypes";
import type { RawOrefPayload } from "../utils/alertNormalization";
import type { GeoBox } from "../../../types";

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

export function useOrefAlerts(wsUrl?: string): UseOrefAlertsResult {
  const [lastUpdate, setLastUpdate] = useState<RawOrefPayload | null>(null);
  const [serverPositions, setServerPositions] = useState<Record<string, GeoBox>>({});
  const [connected, setConnected] = useState(false);
  const [serverTrajectoryByAlertId, setServerTrajectoryByAlertId] = useState<Record<string, ServerTrajectory>>({});
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
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
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
    },
      wsUrl
    );
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [wsUrl]);

  return { lastUpdate, serverPositions, connected, serverTrajectoryByAlertId };
}
