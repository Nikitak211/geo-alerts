/**
 * Hook: subscribe to OREF WebSocket and expose last oref_update + place_positions + strike_news.
 */

import { useEffect, useRef, useState } from "react";
import { createOrefSocket } from "../services/orefSocket";
import { OrefEventTypes } from "../constants/alertTypes";
import type { RawOrefPayload } from "../utils/alertNormalization";
import type { GeoBox } from "../../../types";
import type { StrikeNewsItem } from "../../strikeNews/types";

export type UseOrefAlertsResult = {
  lastUpdate: RawOrefPayload | null;
  serverPositions: Record<string, GeoBox>;
  strikeNewsItems: StrikeNewsItem[];
  connected: boolean;
};

export function useOrefAlerts(wsUrl?: string): UseOrefAlertsResult {
  const [lastUpdate, setLastUpdate] = useState<RawOrefPayload | null>(null);
  const [serverPositions, setServerPositions] = useState<Record<string, GeoBox>>({});
  const [strikeNewsItems, setStrikeNewsItems] = useState<StrikeNewsItem[]>([]);
  const [connected, setConnected] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubscribeRef.current = createOrefSocket(
      {
        onMessage: (msg) => {
          if (msg.type === OrefEventTypes.OrefUpdate && msg.payload) {
            setLastUpdate(msg.payload);
          } else if (msg.type === OrefEventTypes.PlacePositions && msg.payload) {
            setServerPositions((prev) => ({ ...prev, ...msg.payload }));
          } else if (msg.type === OrefEventTypes.StrikeNews && msg.payload) {
            setStrikeNewsItems(msg.payload);
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

  return { lastUpdate, serverPositions, strikeNewsItems, connected };
}
