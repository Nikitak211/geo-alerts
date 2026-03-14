const API_BASE = (() => {
  const envBase =
    typeof process !== "undefined" && (process as any).env?.REACT_APP_API_BASE;
  if (envBase) return envBase;

  // Prefer same-origin in production so the API is served from the same host
  // as the built client. Fallback to the historical dev default if window
  // is not available (e.g. in tests or SSR-like environments).
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:8090";
})();

/** Base URL for API (e.g. for FormData uploads that must not set Content-Type). */
export function getApiBase(): string {
  return API_BASE;
}

/** WebSocket URL for alerts. Uses REACT_APP_WS_URL or derives from current host. */
export function getWsUrl(): string {
  const env = typeof process !== "undefined" && (process as any).env;
  if (env?.REACT_APP_WS_URL) return env.REACT_APP_WS_URL;
  if (typeof window === "undefined") return "ws://localhost:5535";
  const { protocol, hostname, port } = window.location;
  const wsProto = protocol === "https:" ? "wss:" : "ws:";
  const effectivePort = port || (protocol === "https:" ? "443" : "80");

  // Legacy dev behavior: client on 4421, Node WS server on 5535, when no env override.
  if (hostname === "localhost" && (port === "4421" || !port)) {
    return `${wsProto}//${hostname}:5535`;
  }

  // Default: same-origin WebSocket endpoint (to be backed by the .NET server),
  // using a fixed path that the ASP.NET Core backend will expose.
  return `${wsProto}//${hostname}:${effectivePort}/ws`;
}

/** .NET backend default WS port when not same-origin (e.g. dev client on 4421, backend on 8080). */
const DEFAULT_OREF_HUB_PORT = "8080";

/** SignalR hub URL (HTTP/HTTPS) for /ws. Use for HubConnectionBuilder.withUrl(). */
export function getSignalRHubUrl(): string {
  const env = typeof process !== "undefined" && (process as any).env;
  const envUrl = env?.REACT_APP_WS_URL as string | undefined;
  if (envUrl) {
    const s = envUrl.trim();
    // Legacy Node WS was on 5535; .NET hub is on 8080 (or same-origin). Prefer .NET when env still points at Node.
    if (s.includes(":5535")) {
      if (typeof window !== "undefined") return `${window.location.origin}/ws`;
      return `http://localhost:${DEFAULT_OREF_HUB_PORT}/ws`;
    }
    if (s.startsWith("ws://")) return "http" + s.slice(2);
    if (s.startsWith("wss://")) return "https" + s.slice(3);
    return s;
  }
  if (typeof window !== "undefined") return `${window.location.origin}/ws`;
  return `http://localhost:${DEFAULT_OREF_HUB_PORT}/ws`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const userId = localStorage.getItem("userId");

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

/** POST FormData to path (e.g. screenshot upload). Do not set Content-Type so browser sends multipart boundary. */
export async function postFormData<T = { ok?: boolean; sent?: boolean }>(
  path: string,
  form: FormData,
  init?: RequestInit
): Promise<T> {
  const userId = localStorage.getItem("userId");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: form,
    headers: {
      ...(userId ? { "x-user-id": userId } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Alert API paths and methods (GET render-data, POST screenshot). */
export const alertsApi = {
  /** GET /api/alerts/{id}/render-data — trajectory + screenshot metadata. */
  renderDataPath: (alertId: string) => `/api/alerts/${encodeURIComponent(alertId)}/render-data`,

  /** POST /api/alerts/{id}/screenshot — upload screenshot + metadata; server forwards to Telegram. */
  screenshotPath: (alertId: string) => `/api/alerts/${encodeURIComponent(alertId)}/screenshot`,

  /** Fetch render-data for an alert. */
  getRenderData<T = { trajectoryPolyline?: [number, number][]; trajectoryTarget?: string }>(
    alertId: string
  ): Promise<T> {
    return api<T>(this.renderDataPath(alertId));
  },

  /** POST screenshot FormData for an alert (server sends to Telegram). */
  submitScreenshot(
    alertId: string,
    form: FormData
  ): Promise<{ ok?: boolean; sent?: boolean }> {
    return postFormData(this.screenshotPath(alertId), form);
  },
};
