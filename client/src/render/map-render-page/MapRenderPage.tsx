/**
 * Dedicated render page for screenshot generation.
 * Shows computed trajectory and missile icon at randomized Iran origin. Zoomed close on origin.
 */

import "leaflet/dist/leaflet.css";
import { FC, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap, Marker } from "react-leaflet";
import type { InferenceRenderData } from "./types";
import {
  LAUNCH_REGION_LABEL,
  WEAK_DATA_REGION_FALLBACK,
  CONFIDENCE_LABEL,
  formatConfidenceDisplay,
} from "./displayRules";
import missileIconUrl from "../../components/Pin/missile.png";
import { getApiBase, alertsApi } from "../../utils/helper";
import {
  configuredMapTiles,
  fallbackMapTiles,
} from "../../utils/mapTiles";

/** Zoom level for "really close" on city/area of trajectory origin. */
const ORIGIN_ZOOM = 12;

/** Western Iran fallback when no origin point (lat, lng). */
const WESTERN_IRAN_CENTER: [number, number] = [32.5, 48.5];
const FALLBACK_ZOOM = 8;

/** Delay after first tile load before marking render ready. */
const RENDER_READY_DELAY_MS = 1800;
/** Max wait for tiles; after this we signal ready anyway so the worker doesn't timeout. */
const TILE_LOAD_MAX_WAIT_MS = 8000;
/** Absolute max wait; always signal ready so the worker never times out. */
const ABSOLUTE_MAX_WAIT_MS = 12000;

/** Leaflet icon for trajectory origin (missile.png). */
const missileIcon = L.icon({
  iconUrl: missileIconUrl,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function getAlertIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/render\/alert\/([^/]+)\/?$/i);
  if (match) return match[1];
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

/** Focus point from URL (?lat=...&lon=...) so screenshot matches the Telegram Google link. */
function getFocusFromUrl(): { lat: number; lon: number } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const lat = params.get("lat");
  const lon = params.get("lon");
  if (lat == null || lon == null) return null;
  const latN = Number(lat);
  const lonN = Number(lon);
  if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return null;
  return { lat: latN, lon: lonN };
}

/** Hide the info overlay when ?noOverlay=1 (for client screenshot capture). */
function shouldHideOverlay(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("noOverlay") === "1";
}
/** Center map on trajectory origin (from URL focus or data); zoom stays on the location, not the full line. */
const ZoomToOrigin: FC<{
  data: InferenceRenderData;
  focusFromUrl: { lat: number; lon: number } | null;
}> = ({ data, focusFromUrl }) => {
  const map = useMap();
  useEffect(() => {
    const center = focusFromUrl ?? data.trajectoryOriginPoint ?? null;
    if (center) {
      map.setView([center.lat, center.lon], ORIGIN_ZOOM);
    } else {
      map.setView(WESTERN_IRAN_CENTER, FALLBACK_ZOOM);
    }
  }, [map, data, focusFromUrl]);
  return null;
};

/** Calls onTileLoad when the first map tile has loaded (so we don't screenshot a blank map). */
const MapTileWatcher: FC<{ onTileLoad: () => void }> = ({ onTileLoad }) => {
  const map = useMap();
  useEffect(() => {
    let fired = false;
    const onLoad = (): void => {
      if (fired) return;
      fired = true;
      onTileLoad();
    };
    map.on("tileload", onLoad);
    return () => {
      map.off("tileload", onLoad);
    };
  }, [map, onTileLoad]);
  return null;
};

function setRenderReady(alertId: string | null): void {
  const win = window as unknown as { __RENDER_READY__?: boolean };
  win.__RENDER_READY__ = true;
  window.dispatchEvent(new CustomEvent("render-ready"));
  if (window.parent !== window && alertId) {
    window.parent.postMessage({ type: "render-ready", alertId }, "*");
  }
}

export const MapRenderPage: FC = () => {
  const [data, setData] = useState<InferenceRenderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tileLoaded, setTileLoaded] = useState(false);
  const [tileConfig, setTileConfig] = useState(configuredMapTiles);

  const alertId = useMemo(() => getAlertIdFromUrl(), []);
  const focusFromUrl = useMemo(() => getFocusFromUrl(), []);
  const hideOverlay = useMemo(() => shouldHideOverlay(), []);

  // Fallback: always signal ready after ABSOLUTE_MAX_WAIT_MS so the worker never times out
  useEffect(() => {
    const t = setTimeout(() => setRenderReady(alertId ?? null), ABSOLUTE_MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, [alertId]);

  useEffect(() => {
    if (!alertId) {
      setError("Missing ?id= alert id");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${getApiBase()}${alertsApi.renderDataPath(alertId)}`,
        );
        if (!res.ok) {
          setError(`Failed to load: ${res.status}`);
          return;
        }
        const json = (await res.json()) as InferenceRenderData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alertId]);

  // Only signal render-ready after at least one map tile has loaded, then delay. Never save blank map.
  useEffect(() => {
    if (!data) return;
    const win = window as unknown as { __ALGORITHM_VERSION__?: string };
    win.__ALGORITHM_VERSION__ = data.summary?.algorithmVersion ?? "";

    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReady = (): void => {
      if (delayTimer) return;
      delayTimer = setTimeout(() => {
        setReady(true);
        setRenderReady(alertId ?? null);
      }, RENDER_READY_DELAY_MS);
    };

    if (tileLoaded) {
      scheduleReady();
    }

    // Fallback: if tiles never load (e.g. headless/network), signal ready anyway so worker doesn't timeout.
    maxWaitTimer = setTimeout(() => {
      if (!delayTimer) scheduleReady();
    }, TILE_LOAD_MAX_WAIT_MS);

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (maxWaitTimer) clearTimeout(maxWaitTimer);
    };
  }, [data, tileLoaded, alertId]);

  if (error) {
    return (
      <div
          style={{
            width: "100vw",
            height: "100vh",
            background: "#1a1b23",
            color: "#EAEAEA",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "sans-serif",
          }}
        >
          {error}
        </div>
    );
  }

  if (!data) {
    return (
      <div
          style={{
            width: "100vw",
            height: "100vh",
            background: "#1a1b23",
            color: "#EAEAEA",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "sans-serif",
          }}
        >
          Loading…
        </div>
    );
  }

  const origin = focusFromUrl ?? data.trajectoryOriginPoint ?? null;

  const impactAreaText =
    (data.impactAreaNames && data.impactAreaNames.length > 0
      ? data.impactAreaNames.join(", ")
      : (data.settlementMarkers ?? []).map((m) => m.name).join(", ")) || "—";
  const receivedAtText = data.receivedAt
    ? new Date(data.receivedAt).toISOString().replace("T", " ").slice(0, 19)
    : "—";
  const launchRegionText =
    data.summary?.estimatedLaunchRegion ??
    (data.summary?.confidence === "low" ? WEAK_DATA_REGION_FALLBACK : "—");
  const confidenceText = formatConfidenceDisplay(data.summary?.confidence);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <MapContainer
        center={origin ? [origin.lat, origin.lon] : WESTERN_IRAN_CENTER}
        zoom={origin ? ORIGIN_ZOOM : FALLBACK_ZOOM}
        style={{ width: "100%", height: "100%", background: "#1a1b23" }}
        zoomControl={false}
        attributionControl
      >
        <TileLayer
          key={tileConfig.provider}
          url={tileConfig.url}
          attribution={tileConfig.attribution}
          maxZoom={tileConfig.maximumLevel}
          eventHandlers={{
            tileerror: () => {
              if (tileConfig.provider === "stadia") {
                setTileConfig(fallbackMapTiles);
              }
            },
          }}
        />
        <ZoomToOrigin data={data} focusFromUrl={focusFromUrl} />
        <MapTileWatcher onTileLoad={() => setTileLoaded(true)} />

        {origin && (
          <Marker position={[origin.lat, origin.lon]} icon={missileIcon} />
        )}
      </MapContainer>

      {!hideOverlay && (
        <div
          style={{
            position: "absolute",
            left: 16,
            bottom: 16,
            right: 16,
            padding: "12px 16px",
            background: "rgba(26, 27, 35, 0.92)",
            color: "#EAEAEA",
            fontFamily: "sans-serif",
            fontSize: 13,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.12)",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "4px 24px",
            maxWidth: 560,
          }}
        >
          <span style={{ opacity: 0.8 }}>Alert time</span>
          <span>{receivedAtText}</span>
          <span style={{ opacity: 0.8 }}>Impact area</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {impactAreaText}
          </span>
          <span style={{ opacity: 0.8 }}>{LAUNCH_REGION_LABEL}</span>
          <span>{launchRegionText}</span>
          <span style={{ opacity: 0.8 }}>{CONFIDENCE_LABEL}</span>
          <span>{confidenceText}</span>
        </div>
      )}

      {ready && <meta name="render-ready" content="true" />}
    </div>
  );
};
