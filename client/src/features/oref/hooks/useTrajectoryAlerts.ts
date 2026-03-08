/**
 * Hook: from OREF alerts, normalize → eligibility → trajectory; expose list for multiple polylines.
 * Same alert id re received → recompute trajectory and update that item (so 105-area update moves the line).
 * New alert → add to list. Items are removed when their clearing timer expires.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useOrefAlerts } from "./useOrefAlerts";
import { normalizeOrefAlert } from "../utils/alertNormalization";
import { isEligibleForTrajectory, toEligibleAlert } from "../utils/alertEligibility";
import { computeTrajectory } from "../utils/trajectory";
import type { BoundarySegment } from "../utils/iranBoundary";
import type { IranGeoJsonFeature } from "./useIranBoundary";
import type { OrefAlert } from "../types/oref.types";
import type { TrajectoryResult } from "../types/oref.types";

export type TrajectoryAlertState = {
  id: string;
  alert: OrefAlert;
  result: TrajectoryResult;
};

const CLEAR_AFTER_MS = 5 * 60 * 1000;
const CLEAR_INTERVAL_MS = 5000;

export function useTrajectoryAlerts(
  wsUrl?: string,
  iranBoundarySegments?: BoundarySegment[] | null,
  iranGeoJson?: IranGeoJsonFeature[] | null
): {
  trajectoryAlerts: TrajectoryAlertState[];
  lastUpdate: ReturnType<typeof useOrefAlerts>["lastUpdate"];
  strikeNewsItems: ReturnType<typeof useOrefAlerts>["strikeNewsItems"];
  connected: boolean;
  clearTrajectories: () => void;
} {
  const { lastUpdate, serverPositions, strikeNewsItems, connected } = useOrefAlerts(wsUrl);
  const [trajectoryAlerts, setTrajectoryAlerts] = useState<TrajectoryAlertState[]>([]);
  const clearAtByIdRef = useRef<Map<string, number>>(new Map());
  const idsRef = useRef<Set<string>>(new Set());

  const clearTrajectories = useCallback(() => {
    setTrajectoryAlerts([]);
    clearAtByIdRef.current.clear();
    idsRef.current.clear();
  }, []);

  useEffect(() => {
    idsRef.current = new Set(trajectoryAlerts.map((p) => p.id));
  }, [trajectoryAlerts]);

  useEffect(() => {
    if (!lastUpdate?.id || !Array.isArray(lastUpdate.data) || lastUpdate.data.length === 0) {
      return;
    }
    const id = String(lastUpdate.id);

    // Use only this alert's area names for positions (each alert calculated by its own data, not shared pins).
    const positionByPlace: Record<string, { lat: number; lon: number }> = {};
    const alertPlaceNames = lastUpdate.data ?? [];
    for (const name of alertPlaceNames) {
      const box = serverPositions[name];
      if (box?.center && Number.isFinite(box.center.lat) && Number.isFinite(box.center.lon)) {
        positionByPlace[name] = { lat: box.center.lat, lon: box.center.lon };
      }
    }

    const normalized = normalizeOrefAlert(lastUpdate, positionByPlace);
    if (!isEligibleForTrajectory(normalized)) {
      if (idsRef.current.has(id)) {
        clearAtByIdRef.current.set(id, Date.now() + CLEAR_AFTER_MS);
      }
      return;
    }

    const eligible = toEligibleAlert(normalized);
    if (!eligible) return;

    const positions = eligible.areas.map((a) => a.point);
    const areaCount = eligible.areas.length;
    const centerOffsetNorthKm =
      areaCount === 40 ? 30 : areaCount > 40 ? (areaCount - 40) * 0.4 : undefined;
    const result = computeTrajectory(
      positions,
      iranBoundarySegments,
      iranGeoJson,
      centerOffsetNorthKm
    );
    if (!result) return;

    const clearAt = Date.now() + CLEAR_AFTER_MS;
    clearAtByIdRef.current.set(id, clearAt);

    const newItem: TrajectoryAlertState = { id, alert: eligible, result };

    setTrajectoryAlerts((prev) => {
      const byId = prev.find((p) => p.id === id);
      if (byId) {
        return prev.map((p) => (p.id === id ? newItem : p));
      }
      return [...prev, newItem];
    });
  }, [lastUpdate, serverPositions, iranBoundarySegments, iranGeoJson]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setTrajectoryAlerts((prev) => {
        const next = prev.filter((p) => (clearAtByIdRef.current.get(p.id) ?? 0) > now);
        return next.length === prev.length ? prev : next;
      });
    }, CLEAR_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return { trajectoryAlerts, lastUpdate, strikeNewsItems, connected, clearTrajectories };
}
