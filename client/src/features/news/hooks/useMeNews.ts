import { useCallback, useEffect, useState } from "react";
import { getApiBase } from "../../../utils/helper";
import type { NewsItem, NewsType } from "../types";

const POLL_MS = 5 * 60 * 1000;

const VALID_TYPES: NewsType[] = [
  "conflict",
  "diplomacy",
  "security",
  "humanitarian",
  "politics",
];

function normalizeItem(raw: Record<string, unknown>): NewsItem | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const title = typeof raw.title === "string" ? raw.title : null;
  const lat = typeof raw.lat === "number" ? raw.lat : Number(raw.lat);
  const lon = typeof raw.lon === "number" ? raw.lon : Number(raw.lon);
  if (!id || !title || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const typeRaw = typeof raw.type === "string" ? raw.type : "politics";
  const type = (VALID_TYPES.includes(typeRaw as NewsType)
    ? typeRaw
    : "politics") as NewsType;

  return {
    id,
    title,
    summary: typeof raw.summary === "string" ? raw.summary : title,
    url: typeof raw.url === "string" ? raw.url : "",
    lat,
    lon,
    type,
    seenAt:
      typeof raw.seenAt === "string" ? raw.seenAt : new Date().toISOString(),
    domain: typeof raw.domain === "string" ? raw.domain : "",
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
  };
}

export function useMeNews(): {
  items: NewsItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/news`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
      const next: NewsItem[] = [];
      for (const row of list) {
        if (row && typeof row === "object") {
          const n = normalizeItem(row as Record<string, unknown>);
          if (n) next.push(n);
        }
      }
      setItems(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "News fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void refresh();
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refresh]);

  return { items, loading, error, refresh };
}
