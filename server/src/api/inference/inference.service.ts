/**
 * Inference API service: in-memory alert store, runInference, render-data builder, optional DB replay.
 */

import type { AlertEvent, InferenceResult } from "../../domain/alerts/types";
import type { RunInferenceResult } from "../../geo/inference/runInference";
import { runInference } from "../../geo/inference/runInference";
import { loadIranCandidates } from "../../geo/candidates";
import { mapNormalizedToAlertEvent } from "../../domain/alerts/mappers";
import type { PersistAlertRow } from "../../storage/repositories/alertRepository";
import type { PersistInferenceRow } from "../../storage/repositories/inferenceRepository";
import type {
  InferenceRenderData,
  SettlementMarker,
  MapPolygon,
  RankedCandidatePolygon,
  SummaryLabels,
  TrajectoryOriginPoint,
  TrajectoryTarget,
} from "./types";
import { centroidOfRing, bearingBetween, destinationPoint } from "../../geo/inference/math";
import { loadIrBases, findClosestBase, pickRandomOriginNearTrajectory } from "../../geo/irBases";
import { createIsPointInIran, findIranBorderCrossingAlongRay } from "../../geo/iranBoundary";
import { findLebanonCrossingAlongRay } from "../../geo/lebanonBoundary";
import { computeTrajectoryAssumption } from "../../geo/trajectoryAssumption";
import type { LonLat } from "../../domain/alerts/types";

const POLYLINE_SEGMENTS = 16;

/** Max trajectory length (km) when using corridor fallback (no principal bearing). */
const EXTEND_MAX_KM = 1300;

/** Fallback point inside Iran (screenshot/link) when computed point is in sea or outside border. Central Iran, lon/lat. */
const FALLBACK_IRAN_INLAND: LonLat = [51.7, 32.6];

/** Rough Persian Gulf box (lon, lat) — points here are in the sea; never use for screenshot/link. */
function isInPersianGulf([lon, lat]: LonLat): boolean {
  return lon >= 48.5 && lon <= 53.5 && lat >= 25.5 && lat <= 30.5;
}

const MAX_RECENT = 50;

export interface InferenceServiceDeps {
  geojsonPath?: string;
  iranCandidatesPath?: string;
  /** Path to ir_bases.json for randomized trajectory origin (closest base + random offset). */
  irBasesPath?: string;
  /** Path to Iran boundary GeoJSON (e.g. client/public/data/ir.json) to keep random origin inside Iran. */
  iranBoundaryPath?: string;
  /** Path to Lebanon boundary GeoJSON (e.g. client/public/data/lb.json). When trajectory hits Lebanon, no screenshot. */
  lebanonBoundaryPath?: string;
  /** Optional: load alert by id from DB when not in memory (replay). */
  getAlertByIdFromDb?: (id: string) => Promise<PersistAlertRow | null>;
  /** Optional: load inference by alert id from DB (replay). */
  getInferenceByAlertIdFromDb?: (alertId: string) => Promise<(PersistInferenceRow & { id: number; createdAt: string }) | null>;
}

export function createInferenceService(deps: InferenceServiceDeps = {}) {
  const store: {
    active: AlertEvent | null;
    byId: Map<string, AlertEvent>;
    inferenceByAlertId: Map<string, RunInferenceResult>;
  } = { active: null, byId: new Map(), inferenceByAlertId: new Map() };

  function setActiveAlert(alert: AlertEvent): void {
    store.active = alert;
    store.byId.set(alert.id, alert);
    if (store.byId.size > MAX_RECENT) {
      const first = store.byId.keys().next().value;
      if (first) store.byId.delete(first);
    }
  }

  function getActiveAlert(): AlertEvent | null {
    return store.active;
  }

  function getAlertByIdSync(id: string): AlertEvent | null {
    return store.byId.get(id) ?? (store.active?.id === id ? store.active : null);
  }

  async function getAlertById(id: string): Promise<AlertEvent | null> {
    const fromMemory = getAlertByIdSync(id);
    if (fromMemory) return fromMemory;
    if (!deps.getAlertByIdFromDb) return null;
    try {
      const row = await deps.getAlertByIdFromDb(id);
      if (!row) return null;
    const alert: AlertEvent = {
      ...mapNormalizedToAlertEvent(row.normalizedAlert, row.rawPayload as import("../../ingest/oref/types").RawOrefPayload, {
        receivedAt: row.receivedAt ?? new Date().toISOString(),
      }),
      source: "replay",
    };
    store.byId.set(alert.id, alert);
    return alert;
    } catch (_e) {
      return null;
    }
  }

  async function runInferenceForAlert(alert: AlertEvent): Promise<RunInferenceResult | null> {
    const result = await runInference(alert, {
      geojsonPath: deps.geojsonPath,
      iranCandidatesPath: deps.iranCandidatesPath,
    });
    if (result) {
      store.inferenceByAlertId.set(alert.id, result);
      if (store.inferenceByAlertId.size > MAX_RECENT) {
        const first = store.inferenceByAlertId.keys().next().value;
        if (first) store.inferenceByAlertId.delete(first);
      }
    }
    return result;
  }

  /** Get inference result for an alert (memory cache, then DB if persisted, else run pipeline). */
  async function getInferenceResultForAlert(alertId: string): Promise<RunInferenceResult | null> {
    const fromMemory = store.inferenceByAlertId.get(alertId);
    if (fromMemory) return fromMemory;

    const alert = await getAlertById(alertId);
    if (!alert) return null;

    if (deps.getInferenceByAlertIdFromDb) {
      try {
        const persisted = await deps.getInferenceByAlertIdFromDb(alertId);
        if (persisted) {
          const result: RunInferenceResult = {
            alertId: persisted.alertId,
            algorithmVersion: persisted.algorithmVersion,
            cluster: persisted.cluster,
            corridor: persisted.corridor,
            rankedCandidates: persisted.rankedCandidates,
            summary: persisted.summary,
          };
          return result;
        }
      } catch (_e) {
        // DB tables may not exist; fall through to run pipeline
      }
    }
    return runInferenceForAlert(alert);
  }

  function buildRenderData(result: RunInferenceResult): InferenceRenderData {
    const { cluster, corridor, rankedCandidates, summary } = result;

    const settlementMarkers: SettlementMarker[] = cluster.matchedSettlements.map((s, i) => ({
      id: `settlement-${i}-${s.name}`,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      confidence: s.confidence,
    }));

    const clusterPolygon: MapPolygon | null =
      cluster.hull?.length && cluster.hull[0]?.length
        ? { type: "Polygon", coordinates: cluster.hull }
        : null;

    const corridorPolygon: MapPolygon | null =
      corridor.polygon?.length && corridor.polygon[0]?.length
        ? { type: "Polygon", coordinates: corridor.polygon }
        : null;

    const candidates = loadIranCandidates({ dataPath: deps.iranCandidatesPath });
    const rankedCandidatePolygons: RankedCandidatePolygon[] = [];
    rankedCandidates.forEach((r, index) => {
      const c = candidates.find((x) => x.id === r.candidateId);
      if (!c?.geometry) return;
      const coords =
        c.geometry.type === "Polygon"
          ? c.geometry.coordinates
          : (c.geometry.coordinates[0] as [number, number][][] | undefined) ?? [];
      rankedCandidatePolygons.push({
        candidateId: c.id,
        name: c.name,
        rank: index + 1,
        score: r.score,
        polygon: { type: "Polygon", coordinates: coords as [number, number][][] },
      });
    });

    const summaryLabels: SummaryLabels = {
      confidence: summary.confidence,
      confidenceLabel: summary.confidenceLabel,
      estimatedLaunchRegion: summary.estimatedLaunchRegion,
      algorithmVersion: result.algorithmVersion,
    };

    // Trajectory: principal bearing; check Lebanon first (no screenshot when trajectory points to Lebanon).
    const positions: LonLat[] = cluster.matchedSettlements.map((s) => [s.lon, s.lat]);
    const irBases = loadIrBases(deps.irBasesPath);
    const irBasesCoords: LonLat[] = irBases.map((b) => b.coordinates);
    const trajectoryResult = computeTrajectoryAssumption(
      cluster.centroid,
      positions,
      cluster.matchedSettlements.length,
      irBasesCoords
    );

    let originLonLat: [number, number];
    let trajectoryPolyline: [number, number][];
    let trajectoryTarget: TrajectoryTarget = "iran";

    const lebanonCrossing =
      trajectoryResult &&
      findLebanonCrossingAlongRay(
        cluster.centroid,
        bearingBetween(cluster.centroid, trajectoryResult.endPoint),
        deps.lebanonBoundaryPath
      );

    if (lebanonCrossing) {
      trajectoryTarget = "lebanon";
      originLonLat = [lebanonCrossing[0], lebanonCrossing[1]];
      trajectoryPolyline = [cluster.centroid];
      for (let i = 1; i < POLYLINE_SEGMENTS; i++) {
        const t = i / POLYLINE_SEGMENTS;
        trajectoryPolyline.push([
          cluster.centroid[0] + (lebanonCrossing[0] - cluster.centroid[0]) * t,
          cluster.centroid[1] + (lebanonCrossing[1] - cluster.centroid[1]) * t,
        ]);
      }
      trajectoryPolyline.push(originLonLat);
    } else if (trajectoryResult) {
      trajectoryPolyline = trajectoryResult.polyline;
      originLonLat = trajectoryResult.endPoint;
      if (irBases.length > 0) {
        const isPointInIran = createIsPointInIran(deps.iranBoundaryPath);
        originLonLat = pickRandomOriginNearTrajectory(originLonLat, irBases, {
          isInsideIran: isPointInIran,
          maxRetries: 8,
        });
        trajectoryPolyline = [
          ...trajectoryResult.polyline.slice(0, -1),
          originLonLat,
        ];
      }
    } else {
      // Fewer than 10 positions: no principal bearing. Build a full-length trajectory
      // along the corridor center bearing so the line reaches toward Iran (not a short stub).
      const endPoint = destinationPoint(
        cluster.centroid,
        corridor.centerBearingDeg,
        EXTEND_MAX_KM
      );
      trajectoryPolyline = [cluster.centroid];
      for (let i = 1; i < POLYLINE_SEGMENTS; i++) {
        const t = i / POLYLINE_SEGMENTS;
        trajectoryPolyline.push([
          cluster.centroid[0] + (endPoint[0] - cluster.centroid[0]) * t,
          cluster.centroid[1] + (endPoint[1] - cluster.centroid[1]) * t,
        ]);
      }
      trajectoryPolyline.push(endPoint);
      originLonLat = endPoint;
      if (irBases.length > 0) {
        const isPointInIran = createIsPointInIran(deps.iranBoundaryPath);
        const picked = pickRandomOriginNearTrajectory(originLonLat, irBases, {
          isInsideIran: isPointInIran,
          maxRetries: 8,
        });
        originLonLat = picked;
        trajectoryPolyline = [
          ...trajectoryPolyline.slice(0, -1),
          originLonLat,
        ];
      }
    }

    // Ensure screenshot/link point is inside Iran and on the trajectory (not in sea, not fixed fallback).
    if (trajectoryTarget === "iran") {
      const isPointInIran = createIsPointInIran(deps.iranBoundaryPath);
      const inGulf = isInPersianGulf(originLonLat);
      if (inGulf || !isPointInIran(originLonLat)) {
        const bearingDeg = trajectoryResult
          ? bearingBetween(cluster.centroid, trajectoryResult.endPoint)
          : corridor.centerBearingDeg;
        const onTrajectory = findIranBorderCrossingAlongRay(
          cluster.centroid,
          bearingDeg,
          deps.iranBoundaryPath
        );
        if (onTrajectory) {
          originLonLat = onTrajectory;
        } else if (rankedCandidatePolygons.length > 0) {
          const first = rankedCandidatePolygons[0];
          const ring = first.polygon?.coordinates?.[0] as [number, number][] | undefined;
          if (ring?.length) {
            originLonLat = centroidOfRing(ring);
          }
        }
        if (!isPointInIran(originLonLat) && irBases.length > 0) {
          const base = findClosestBase(originLonLat, irBases);
          if (base) originLonLat = base.coordinates;
        }
        if (!isPointInIran(originLonLat)) {
          originLonLat = FALLBACK_IRAN_INLAND;
        }
        // So the drawn trajectory reaches Iran border and ends on land.
        if (trajectoryPolyline.length >= 2) {
          trajectoryPolyline = [
            ...trajectoryPolyline.slice(0, -1),
            originLonLat,
          ];
        }
      }
    }

    const trajectoryOriginPoint: TrajectoryOriginPoint | null = {
      lat: originLonLat[1],
      lon: originLonLat[0],
      name: trajectoryTarget === "iran" ? rankedCandidatePolygons[0]?.name : undefined,
    };

    return {
      alertId: result.alertId,
      settlementMarkers,
      clusterPolygon,
      corridorPolygon,
      rankedCandidatePolygons,
      trajectoryPolyline,
      trajectoryOriginPoint,
      trajectoryTarget,
      summary: summaryLabels,
    };
  }

  return {
    setActiveAlert,
    getActiveAlert,
    getAlertById,
    getAlertByIdSync,
    runInferenceForAlert,
    getInferenceResultForAlert,
    buildRenderData,
  };
}

export type InferenceService = ReturnType<typeof createInferenceService>;
