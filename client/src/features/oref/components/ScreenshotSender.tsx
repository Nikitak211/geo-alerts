/**
 * Captures MapRenderPage in a hidden iframe (missile marker at Iran origin).
 * Backend controls whether to forward to Telegram (ACCEPT_CLIENT_SCREENSHOTS).
 */

import html2canvas from "html2canvas";
import { FC, useCallback, useEffect, useRef } from "react";
import { useOrefTrajectory } from "../context/OrefTrajectoryContext";
import { useIrBases } from "../hooks/useIrBases";
import { haversineKm, bearing, movePoint, pointInPolygon } from "../utils/geo";
import type { GeoPoint } from "../types/oref.types";
import { alertsApi } from "../../../utils/helper";

/** Max random offset (km) from the closest Iran base. */
const LAUNCH_OFFSET_KM = 60;
/** Max retries to find a point inside Iran. */
const MAX_IRAN_RETRIES = 12;

type IranGeoJsonFeature = { geometry?: { type?: string; coordinates?: unknown } };

function extractIranRings(geojson: IranGeoJsonFeature[] | null): GeoPoint[][] {
  const rings: GeoPoint[][] = [];
  if (!geojson?.length) return rings;
  for (const f of geojson) {
    const geom = f?.geometry;
    const coords = geom?.coordinates;
    if (geom?.type === "Polygon" && Array.isArray(coords) && coords[0]?.length) {
      rings.push(coords[0] as GeoPoint[]);
    } else if (geom?.type === "MultiPolygon" && Array.isArray(coords)) {
      for (const polygon of coords) {
        const ring = polygon?.[0];
        if (Array.isArray(ring) && ring.length >= 3) rings.push(ring as GeoPoint[]);
      }
    }
  }
  return rings;
}

function isPointInIran(point: GeoPoint, rings: GeoPoint[][]): boolean {
  for (const ring of rings) {
    if (pointInPolygon(point, ring)) return true;
  }
  return false;
}

/**
 * Pick a random point within LAUNCH_OFFSET_KM of the nearest Iran base to the trajectory origin.
 * Retries until point is inside Iran; falls back to base coordinates if all retries fail.
 */
function pickLaunchPointNearBase(
  trajectoryOrigin: GeoPoint,
  bases: GeoPoint[],
  iranRings: GeoPoint[][]
): GeoPoint {
  if (!bases?.length) return trajectoryOrigin;
  let best = bases[0];
  let bestKm = haversineKm(trajectoryOrigin, best);
  for (const b of bases) {
    const d = haversineKm(trajectoryOrigin, b);
    if (d < bestKm) {
      bestKm = d;
      best = b;
    }
  }
  if (!iranRings.length) {
    const distKm = Math.random() * LAUNCH_OFFSET_KM;
    const brg = bearing(best, trajectoryOrigin);
    return movePoint(best, brg, distKm);
  }
  for (let attempt = 0; attempt <= MAX_IRAN_RETRIES; attempt++) {
    const distKm = Math.random() * LAUNCH_OFFSET_KM;
    const brg = bearing(best, trajectoryOrigin);
    const point = movePoint(best, brg, distKm);
    if (isPointInIran(point, iranRings)) return point;
  }
  return best;
}

const INITIAL_DELAY_MS = 2500;
const IFRAME_READY_TIMEOUT_MS = 15000;

const log = (msg: string, ...args: unknown[]) => {
  console.log("[ScreenshotSender]", msg, ...args);
};

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [head, base64] = dataUrl.split(",");
    if (!head?.includes("image/png") || !base64) return null;
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: "image/png" });
  } catch {
    return null;
  }
}

interface CaptureMeta {
  lat: number;
  lon: number;
  distanceKm: number | undefined;
  receivedAt: string;
}

export const ScreenshotSender: FC = () => {
  const { trajectoryAlerts, lastUpdate, iranGeoJson } = useOrefTrajectory();
  const irBases = useIrBases();
  const sentForAlertIdRef = useRef<Set<string>>(new Set());
  const trajectoryAlertsRef = useRef(trajectoryAlerts);
  trajectoryAlertsRef.current = trajectoryAlerts;
  const irBasesRef = useRef(irBases);
  irBasesRef.current = irBases;
  const iranRingsRef = useRef<GeoPoint[][]>([]);
  iranRingsRef.current = extractIranRings(iranGeoJson ?? null);

  const doCapture = useCallback(
    async (alertId: string, meta: CaptureMeta) => {
      const appOrigin = window.location.origin;
      const { lat, lon } = meta;
      const url = `${appOrigin}/render/alert/${encodeURIComponent(alertId)}?lat=${lat}&lon=${lon}&noOverlay=1`;

      const iframe = document.createElement("iframe");
      iframe.style.cssText =
        "position:fixed;left:-9999px;top:0;width:1200px;height:800px;border:0;visibility:hidden;";
      document.body.appendChild(iframe);

      const cleanup = () => {
        try {
          document.body.removeChild(iframe);
        } catch {
          /* ignore */
        }
      };

      return new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            reject(new Error("iframe render-ready timeout"));
          }
        }, IFRAME_READY_TIMEOUT_MS);

        let resolved = false;
        const onMessage = (e: MessageEvent) => {
          if (e.data?.type !== "render-ready" || e.data?.alertId !== alertId || resolved) return;
          resolved = true;
          window.removeEventListener("message", onMessage);
          clearTimeout(timeout);

          const doc = iframe.contentDocument;
          const el = doc?.getElementById("root") ?? doc?.body;
          if (!el) {
            cleanup();
            reject(new Error("iframe root not found"));
            resolve();
            return;
          }

          html2canvas(el, {
            useCORS: true,
            allowTaint: true,
            logging: false,
            scale: 1,
          })
            .then((canvas) => {
              const dataUrl = canvas.toDataURL("image/png");
              cleanup();
              if (!dataUrl) {
                reject(new Error("html2canvas toDataURL empty"));
                return;
              }
              const blob = dataUrlToBlob(dataUrl);
              if (!blob) {
                reject(new Error("blob creation failed"));
                return;
              }
              const form = new FormData();
              form.append("file", blob, "screenshot.png");
              if (meta.distanceKm != null) form.append("distanceKm", String(meta.distanceKm));
              form.append("lat", String(meta.lat));
              form.append("lon", String(meta.lon));
              form.append("receivedAt", meta.receivedAt);
              alertsApi
                .submitScreenshot(alertId, form)
                .then((res) => {
                  log("upload ok for alert", alertId, res);
                  sentForAlertIdRef.current.add(alertId);
                })
                .catch((err) => {
                  console.error("[ScreenshotSender] upload failed:", err);
                });
              resolve();
            })
            .catch((err) => {
              cleanup();
              reject(err);
              resolve();
            });
        };

        window.addEventListener("message", onMessage);
        iframe.src = url;
      });
    },
    [],
  );

  useEffect(() => {
    if (!lastUpdate?.id) {
      log("skip: no lastUpdate.id");
      return;
    }
    const alertId = String(lastUpdate.id);
    if (sentForAlertIdRef.current.has(alertId)) {
      log("skip: already sent for alert", alertId);
      return;
    }

    const resolveMetaFrom = (list: typeof trajectoryAlerts, bases: GeoPoint[], iranRings: GeoPoint[][]): CaptureMeta | null => {
      const item = list.find((a) => a.id === alertId);
      if (item?.result?.polyline?.length) {
        const poly = item.result.polyline as GeoPoint[];
        const trajectoryOrigin = poly[poly.length - 1];
        const launchPoint = pickLaunchPointNearBase(trajectoryOrigin, bases, iranRings);
        const distanceKm = poly.length >= 2 ? haversineKm(poly[0], launchPoint) : undefined;
        const receivedAt =
          item.alert.time instanceof Date
            ? item.alert.time.toISOString()
            : new Date().toISOString();
        return { lat: launchPoint[1], lon: launchPoint[0], distanceKm, receivedAt };
      }
      return null;
    };

    log("scheduling capture for alert", alertId, "in", INITIAL_DELAY_MS, "ms");

    const timeout = window.setTimeout(() => {
      const runCapture = async () => {
        const bases = irBasesRef.current;
        const iranRings = iranRingsRef.current;
        let captureMeta = resolveMetaFrom(trajectoryAlertsRef.current, bases, iranRings);
        if (!captureMeta) {
          try {
            const data = await alertsApi.getRenderData<{
              trajectoryOriginPoint?: { lat: number; lon: number };
              trajectoryPolyline?: [number, number][];
              receivedAt?: string;
            }>(alertId);
            const origin = data?.trajectoryOriginPoint;
            const poly = data?.trajectoryPolyline;
            if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lon)) {
              const trajectoryOrigin: GeoPoint = [origin.lon, origin.lat];
              const launchPoint = pickLaunchPointNearBase(trajectoryOrigin, bases, iranRings);
              const receivedAt = data?.receivedAt ?? new Date().toISOString();
              const distanceKm =
                Array.isArray(poly) && poly.length >= 2
                  ? haversineKm(poly[0], launchPoint)
                  : undefined;
              captureMeta = {
                lat: launchPoint[1],
                lon: launchPoint[0],
                distanceKm,
                receivedAt,
              };
            }
          } catch {
            /* render-data not available */
          }
        }
        if (!captureMeta) {
          log("skip: no trajectory or render-data for alert", alertId);
          return;
        }
        await doCapture(alertId, captureMeta);
      };
      runCapture().catch((e) => {
        console.warn("[ScreenshotSender] capture failed:", e);
      });
    }, INITIAL_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [lastUpdate?.id, doCapture]);

  return null;
};
