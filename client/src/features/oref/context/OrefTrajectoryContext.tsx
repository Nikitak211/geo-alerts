/**
 * Single subscription to OREF WS and trajectory state for AlertPinsLayer + AlertTrajectoryLayer.
 * Supports multiple active trajectory alerts (multiple polylines).
 */

import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
} from "react";
import { useIranBoundary } from "../hooks/useIranBoundary";
import { useTrajectoryAlerts } from "../hooks/useTrajectoryAlerts";
import type { TrajectoryAlertState } from "../hooks/useTrajectoryAlerts";
import type { IranGeoJsonFeature } from "../hooks/useIranBoundary";
import type { StrikeNewsItem } from "../../strikeNews/types";

type OrefTrajectoryContextValue = {
  trajectoryAlerts: TrajectoryAlertState[];
  strikeNewsItems: StrikeNewsItem[];
  connected: boolean;
  clearTrajectories: () => void;
  iranGeoJson: IranGeoJsonFeature[] | null;
};

const OrefTrajectoryContext = createContext<OrefTrajectoryContextValue | null>(null);

export function OrefTrajectoryProvider({
  children,
  wsUrl,
}: {
  children: ReactNode;
  wsUrl?: string;
}) {
  const { segments: iranBoundarySegments, geojson: iranGeoJson } = useIranBoundary();
  const { trajectoryAlerts, strikeNewsItems, connected, clearTrajectories } = useTrajectoryAlerts(
    wsUrl,
    iranBoundarySegments,
    iranGeoJson
  );
  const value = useMemo(
    () => ({ trajectoryAlerts, strikeNewsItems, connected, clearTrajectories, iranGeoJson }),
    [trajectoryAlerts, strikeNewsItems, connected, clearTrajectories, iranGeoJson]
  );
  return (
    <OrefTrajectoryContext.Provider value={value}>
      {children}
    </OrefTrajectoryContext.Provider>
  );
}

export function useOrefTrajectory(): OrefTrajectoryContextValue {
  const ctx = useContext(OrefTrajectoryContext);
  if (!ctx) throw new Error("useOrefTrajectory must be used within OrefTrajectoryProvider");
  return ctx;
}
