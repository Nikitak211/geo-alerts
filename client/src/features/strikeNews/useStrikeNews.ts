/**
 * Hook: strike news from OREF WebSocket (server fetches + geocodes, broadcasts strike_news).
 * Must be used within OrefTrajectoryProvider.
 */

import { useOrefTrajectory } from "../oref/context/OrefTrajectoryContext";
import type { StrikeNewsItem } from "./types";

export function useStrikeNews(): {
  items: StrikeNewsItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { strikeNewsItems, connected } = useOrefTrajectory();
  return {
    items: strikeNewsItems,
    loading: false,
    error: connected ? null : "Disconnected",
    refetch: async () => {},
  };
}
