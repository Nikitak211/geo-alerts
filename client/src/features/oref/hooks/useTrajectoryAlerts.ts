/**
 * Hook: from OREF alerts, normalize → eligibility → trajectory; expose list for multiple polylines.
 * Same alert id re received → recompute trajectory and update that item (so 105-area update moves the line).
 * New alert → add to list. Items are removed when their clearing timer expires.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaceResolver } from "../../../contexts/PlaceResolverContext";
import { useOrefAlerts } from "./useOrefAlerts";
import { normalizeOrefAlert } from "../utils/alertNormalization";
import { isEligibleForTrajectory, toEligibleAlert } from "../utils/alertEligibility";
import { computeTrajectory } from "../utils/trajectory";
import { alertsApi } from "../../../utils/helper";
import type { BoundarySegment } from "../utils/iranBoundary";
import type { IranGeoJsonFeature } from "./useIranBoundary";
import type { LebanonGeoJsonFeature } from "./useLebanonBoundary";
import type { GeoBox } from "../../../types";
import type { OrefAlert } from "../types/oref.types";
import type { TrajectoryResult } from "../types/oref.types";
import type { ServerTrajectory } from "./useOrefAlerts";

/** Use server (screenshot) trajectory on main map whenever we have it for Iran, so main map matches screenshot logic (especially south Iran). */

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
  iranGeoJson?: IranGeoJsonFeature[] | null,
  irBases?: Array<[number, number]> | null,
  lebanonGeoJson?: LebanonGeoJsonFeature[] | null
): {
  trajectoryAlerts: TrajectoryAlertState[];
  lastUpdate: ReturnType<typeof useOrefAlerts>["lastUpdate"];
  serverPositions: Record<string, GeoBox>;
  connected: boolean;
  clearTrajectories: () => void;
} {
  const { lastUpdate, serverPositions, connected, serverTrajectoryByAlertId } = useOrefAlerts(wsUrl);
  const placeResolver = usePlaceResolver();
  const [trajectoryAlerts, setTrajectoryAlerts] = useState<TrajectoryAlertState[]>([]);
  /** Fallback: trajectory from GET /api/alerts/:id/render-data when WS inference_result not yet received (main map matches screenshot). */
  const [renderDataTrajectoryByAlertId, setRenderDataTrajectoryByAlertId] = useState<Record<string, ServerTrajectory>>({});
  const fetchStartedForIdRef = useRef<Set<string>>(new Set());
  const retriedRenderDataForIdRef = useRef<Set<string>>(new Set());
  const [renderDataRetryTrigger, setRenderDataRetryTrigger] = useState(0);
  const RETRY_DELAY_MS = 2500;
  const clearAtByIdRef = useRef<Map<string, number>>(new Map());
  const idsRef = useRef<Set<string>>(new Set());

  const clearTrajectories = useCallback(() => {
    setTrajectoryAlerts([]);
    setRenderDataTrajectoryByAlertId({});
    clearAtByIdRef.current.clear();
    idsRef.current.clear();
    fetchStartedForIdRef.current.clear();
    retriedRenderDataForIdRef.current.clear();
  }, []);

  useEffect(() => {
    idsRef.current = new Set(trajectoryAlerts.map((p) => p.id));
  }, [trajectoryAlerts]);

  /* Fallback: fetch render-data for current alert when WS inference_result not yet received so main map matches screenshot. Retry once after delay so we get trajectory after server inference finishes. */
  useEffect(() => {
    if (!lastUpdate?.id || !Array.isArray(lastUpdate.data) || lastUpdate.data.length === 0) return;
    const id = String(lastUpdate.id);
    const positionByPlace: Record<string, { lat: number; lon: number }> = {};
    for (const name of lastUpdate.data ?? []) {
      const box = serverPositions[name];
      if (box?.center && Number.isFinite(box.center.lat) && Number.isFinite(box.center.lon)) {
        positionByPlace[name] = { lat: box.center.lat, lon: box.center.lon };
      } else if (placeResolver?.getCenterForPlace(name)) {
        const c = placeResolver.getCenterForPlace(name)!;
        positionByPlace[name] = { lat: c.lat, lon: c.lon };
      }
    }
    const normalized = normalizeOrefAlert(lastUpdate, positionByPlace);
    if (!isEligibleForTrajectory(normalized)) return;
    if (serverTrajectoryByAlertId[id]?.polyline?.length) return;
    if (renderDataTrajectoryByAlertId[id]?.polyline?.length) return;
    if (fetchStartedForIdRef.current.has(id)) {
      if (renderDataRetryTrigger > 0 && !retriedRenderDataForIdRef.current.has(id)) {
        fetchStartedForIdRef.current.delete(id);
        retriedRenderDataForIdRef.current.add(id);
      } else {
        return;
      }
    }
    if (renderDataRetryTrigger > 0) retriedRenderDataForIdRef.current.add(id);
    fetchStartedForIdRef.current.add(id);
    alertsApi.getRenderData<{
      trajectoryPolyline?: [number, number][];
      trajectoryTarget?: "iran" | "lebanon";
    }>(id)
      .then((data) => {
        const poly = data?.trajectoryPolyline;
        const target = data?.trajectoryTarget ?? "iran";
        if (Array.isArray(poly) && poly.length >= 2) {
          setRenderDataTrajectoryByAlertId((prev) => ({
            ...prev,
            [id]: { polyline: poly, trajectoryTarget: target },
          }));
        } else if (!retriedRenderDataForIdRef.current.has(id)) {
          setTimeout(() => setRenderDataRetryTrigger((n) => n + 1), RETRY_DELAY_MS);
        }
      })
      .catch(() => {
        if (!retriedRenderDataForIdRef.current.has(id)) {
          setTimeout(() => setRenderDataRetryTrigger((n) => n + 1), RETRY_DELAY_MS);
        }
      })
      .finally(() => {
        fetchStartedForIdRef.current.delete(id);
      });
  }, [lastUpdate, serverPositions, placeResolver, serverTrajectoryByAlertId, renderDataTrajectoryByAlertId, renderDataRetryTrigger]);

  useEffect(() => {
    if (!lastUpdate?.id || !Array.isArray(lastUpdate.data) || lastUpdate.data.length === 0) {
      return;
    }
    const id = String(lastUpdate.id);

    // Use only this alert's area names for positions (each alert calculated by its own data, not shared pins).
    // When server doesn't send place_positions (e.g. mock), resolve names from GeoJSON/cities via PlaceResolver.
    const positionByPlace: Record<string, { lat: number; lon: number }> = {};
    const alertPlaceNames = lastUpdate.data ?? [];
    for (const name of alertPlaceNames) {
      const box = serverPositions[name];
      if (box?.center && Number.isFinite(box.center.lat) && Number.isFinite(box.center.lon)) {
        positionByPlace[name] = { lat: box.center.lat, lon: box.center.lon };
      } else if (placeResolver?.getCenterForPlace(name)) {
        const c = placeResolver.getCenterForPlace(name)!;
        positionByPlace[name] = { lat: c.lat, lon: c.lon };
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
    const serverTrajectory = serverTrajectoryByAlertId[id] ?? renderDataTrajectoryByAlertId[id];

    // Prefer server (screenshot) trajectory when we have it for Iran, so main map uses same logic as screenshot (south Iran and all Iran).
    const useServerTrajectory =
      serverTrajectory?.polyline?.length &&
      (serverTrajectory.trajectoryTarget === "iran" || serverTrajectory.trajectoryTarget === "lebanon");

    let result: TrajectoryResult | null;
    if (useServerTrajectory) {
      result = {
        polyline: serverTrajectory!.polyline as import("../types/oref.types").GeoPoint[],
        source: serverTrajectory!.trajectoryTarget,
      };
    } else {
      result = computeTrajectory(
        positions,
        iranBoundarySegments,
        iranGeoJson,
        undefined,
        areaCount,
        irBases,
        lebanonGeoJson
      );
    }
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
  }, [lastUpdate, serverPositions, placeResolver, serverTrajectoryByAlertId, renderDataTrajectoryByAlertId, iranBoundarySegments, iranGeoJson, irBases, lebanonGeoJson]);

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

  return { trajectoryAlerts, lastUpdate, serverPositions, connected, clearTrajectories };
}
