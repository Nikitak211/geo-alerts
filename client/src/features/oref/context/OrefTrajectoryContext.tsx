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
import { useLebanonBoundary } from "../hooks/useLebanonBoundary";
import { useIrBases } from "../hooks/useIrBases";
import { useTrajectoryAlerts } from "../hooks/useTrajectoryAlerts";
import type { TrajectoryAlertState } from "../hooks/useTrajectoryAlerts";
import type { IranGeoJsonFeature } from "../hooks/useIranBoundary";

type OrefTrajectoryContextValue = {
  trajectoryAlerts: TrajectoryAlertState[];
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
  const { geojson: lebanonGeoJson } = useLebanonBoundary();
  const irBases = useIrBases();
  const { trajectoryAlerts, connected, clearTrajectories } = useTrajectoryAlerts(
    wsUrl,
    iranBoundarySegments,
    iranGeoJson,
    irBases,
    lebanonGeoJson
  );
  const value = useMemo(
    () => ({ trajectoryAlerts, connected, clearTrajectories, iranGeoJson }),
    [trajectoryAlerts, connected, clearTrajectories, iranGeoJson]
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
