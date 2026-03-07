/**
 * OREF fetch: fetch raw JSON from OREF API.
 * No raw payload escapes this module as a type; callers use ingest types.
 */

import type { RawOrefPayload } from "./types";

export const OREF_URL =
  "https://www.oref.org.il/WarningMessages/alert/alerts.json";

export const OREF_HEADERS = {
  Referer: "https://www.oref.org.il/",
  "X-Requested-With": "XMLHttpRequest",
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
} as const;

/**
 * Fetch current alerts JSON from OREF.
 * Returns null on empty response or JSON parse error; throws on HTTP/network error.
 */
export async function fetchAlertsJson(): Promise<RawOrefPayload | null> {
  const res = await fetch(OREF_URL, {
    method: "GET",
    headers: OREF_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text || text.trim() === "") return null;
  try {
    return JSON.parse(text) as RawOrefPayload;
  } catch (e) {
    console.error("OREF JSON parse failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
