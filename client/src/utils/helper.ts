const API_BASE =
  (typeof process !== "undefined" && (process as any).env?.REACT_APP_API_BASE) ||
  "http://localhost:8090";

/** WebSocket URL for alerts. Uses REACT_APP_WS_URL or derives from current host. */
export function getWsUrl(): string {
  const env = typeof process !== "undefined" && (process as any).env;
  if (env?.REACT_APP_WS_URL) return env.REACT_APP_WS_URL;
  if (typeof window === "undefined") return "ws://localhost:5535";
  const { protocol, hostname, port } = window.location;
  const wsProto = protocol === "https:" ? "wss:" : "ws:";
  // Dev: client on 4421, WS server on 5535
  const wsPort =
    hostname === "localhost" && (port === "4421" || !port) ? "5535" : port || (protocol === "https:" ? "443" : "80");
  return `${wsProto}//${hostname}:${wsPort}`;
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
