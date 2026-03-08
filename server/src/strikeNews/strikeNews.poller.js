/**
 * Strike news poller: fetch GDELT doc API (Iran/missile/strike), geocode places, feed aggregator.
 * Use setStrikeNews('gdelt', items) when provided; else broadcast (backward compat).
 */

const { excludeIsrael, extractPlaceName, geocodePlace, USER_AGENT } = require("./strikeNews.shared");

const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
/** Poll every 30 min to avoid GDELT 429 rate limits. */
const POLL_INTERVAL_MS = 30 * 60 * 1000;
/** Request fewer records per call to reduce rate-limit pressure. */
const GDELT_MAX_RECORDS = 15;
/** When we get 429, wait this long before next attempt (seconds). */
const RATE_LIMIT_BACKOFF_SEC = 600;

/**
 * GDELT doc API ArtList: returns { articles: [ { url, title, seendate, domain, language, ... } ] }
 */
async function fetchStrikeNews(log) {
  // sourcelang:english = only articles originally published in English (or use 3-letter code per GDELT)
  const query = "iran missile sourcelang:english";
  const url = `${GDELT_DOC_URL}?query=${encodeURIComponent(query)}&mode=ArtList&format=json&maxrecords=${GDELT_MAX_RECORDS}`;
  log("fetching GDELT", url);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    log("GDELT fetch failed", res.status, res.statusText);
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      const waitSec = retryAfter ? parseInt(retryAfter, 10) : RATE_LIMIT_BACKOFF_SEC;
      const sec = Number.isFinite(waitSec) && waitSec > 0 ? Math.min(waitSec, 600) : RATE_LIMIT_BACKOFF_SEC;
      log("rate limited (429), will wait", sec, "s before next poll");
      return { rateLimited: true, waitSec: sec };
    }
    return [];
  }
  const data = await res.json();
  const articles = Array.isArray(data)
    ? data
    : Array.isArray(data?.articles)
      ? data.articles
      : [];
  log("GDELT raw articles", articles.length);
  const ENGLISH_LANG = new Set(["en", "eng", "english"]);
  const out = [];
  const seen = new Set();
  for (const a of articles) {
    const lang = (a.language || "").toString().toLowerCase();
    if (lang && !ENGLISH_LANG.has(lang)) continue;
    const title = (a.title || "").trim();
    if (!title || seen.has(title)) continue;
    const description = "";
    if (excludeIsrael({ title, description })) continue;
    seen.add(title);
    const placeName = extractPlaceName(title, description);
    const id = `strike-${out.length}-${title.slice(0, 40).replace(/\s/g, "-")}`;
    out.push({
      id,
      title,
      description,
      url: a.url || "",
      publishedAt: a.seendate || "",
      sourceName: a.domain || "",
      placeName: placeName || null,
    });
  }
  log("after filter (no Israel, dedup)", out.length);
  return out;
}

function isRateLimitedResult(result) {
  return result && typeof result === "object" && result.rateLimited === true;
}

function createStrikeNewsPoller(deps) {
  const { setStrikeNews, broadcast, sleep } = deps;
  const push = setStrikeNews
    ? (items) => setStrikeNews("gdelt", items)
    : (items) => broadcast({ type: "strike_news", ts: Date.now(), payload: items });
  const log = (...args) => console.log("[strikeNews]", ...args);

  async function pollOnce() {
    log("poll start");
    try {
      const result = await fetchStrikeNews(log);
      if (isRateLimitedResult(result)) {
        await sleep((result.waitSec || RATE_LIMIT_BACKOFF_SEC) * 1000);
        return;
      }
      const articles = Array.isArray(result) ? result : [];
      if (articles.length === 0) {
        log("no articles to geocode, skip broadcast");
        return;
      }
      const items = [];
      for (const a of articles) {
        const placeName = a.placeName || a.title.split(/[,-]/)[0].trim() || null;
        if (!placeName) continue;
        const coords = await geocodePlace(placeName);
        if (coords) {
          items.push({ ...a, lat: coords.lat, lon: coords.lon });
        }
        await sleep(200);
      }
      log("geocoded", items.length, "of", articles.length, "articles");
      if (items.length > 0) {
        push(items);
        log("broadcast", items.length, "items");
      } else {
        log("no items with coordinates, skip broadcast");
      }
    } catch (e) {
      console.error("[strikeNews] poll error:", e?.message || e, e?.stack);
    }
    log("poll done, next in", POLL_INTERVAL_MS / 60000, "min");
  }

  async function loop() {
    log("loop started, interval", POLL_INTERVAL_MS / 60000, "min");
    while (true) {
      await pollOnce();
      await sleep(POLL_INTERVAL_MS);
    }
  }

  return { pollOnce, loop };
}

module.exports = { createStrikeNewsPoller };
