import { FC, useEffect, useState } from "react";
import { Box } from "@mui/material";
import { getApiBase } from "../../../utils/helper";

type NewsStatus = {
  available: boolean;
  count: number;
  source: "gdelt" | "rss" | "none" | string;
  updatedAt: string | null;
  stale: boolean;
  lastError: string | null;
};

const POLL_MS = 5 * 60 * 1000;
const RETRY_MS = 30 * 1000;

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
}

/** Builds the notice text, or null when news is live from the primary source (nothing to say). */
export function newsNoticeText(s: NewsStatus | null, fetchFailed: boolean): { he: string; en: string } | null {
  if (fetchFailed || !s || !s.available) {
    return { he: "החדשות אינן זמינות כרגע", en: "News is temporarily unavailable" };
  }
  const t = timeLabel(s.updatedAt);
  if (s.stale) {
    return { he: `חדשות שמורות, עודכנו ב-${t}`, en: `Showing saved news from ${t}` };
  }
  if (s.source === "rss") {
    return { he: "חדשות ממקור גיבוי (Times of Israel)", en: "News from backup source (Times of Israel)" };
  }
  return null;
}

/** Small status chip shown when the news layer is empty, stale or served from the fallback feed. */
export const NewsStatusNotice: FC = () => {
  const [status, setStatus] = useState<NewsStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    // Poll slowly while news is available, quickly (30s) while it isn't, so the notice clears
    // soon after the first /api/news request fills the server cache.
    const load = () =>
      fetch(`${getApiBase()}/api/news/status`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((s: NewsStatus) => {
          if (cancelled) return;
          setStatus(s);
          setFailed(false);
          schedule(s.available ? POLL_MS : RETRY_MS);
        })
        .catch(() => {
          if (cancelled) return;
          setFailed(true);
          schedule(RETRY_MS);
        });
    const schedule = (ms: number) => {
      timer = window.setTimeout(load, ms);
    };
    schedule(4000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);

  if (!status && !failed) return null;
  const text = newsNoticeText(status, failed);
  if (!text) return null;

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: "absolute",
        right: 8,
        bottom: { xs: "calc(64px + env(safe-area-inset-bottom))", sm: 32 },
        zIndex: 11,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        bgcolor: "rgba(26,29,26,0.9)",
        color: "#e6ecdf",
        fontSize: 13,
        maxWidth: { xs: "45vw", sm: 360 },
      }}
    >
      <span lang="he" dir="rtl">{text.he}</span> · <span lang="en">{text.en}</span>
    </Box>
  );
};
