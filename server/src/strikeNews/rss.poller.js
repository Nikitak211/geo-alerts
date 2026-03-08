/**
 * Strike news from RSS feeds (BBC, Al Jazeera, etc.). Lightweight XML parsing, no extra deps.
 * Poll every 2–5 min; RSS is simple XML and tolerates polite polling.
 * Reuters/AP have deprecated public RSS; we use BBC and Al Jazeera (same quality, free, fast).
 */

const { excludeIsrael, extractPlaceName, geocodePlace, USER_AGENT } = require("./strikeNews.shared");

/** Poll every 3 min – RSS endpoints are usually fine with this. */
const POLL_INTERVAL_MS = 3 * 60 * 1000;

/** Default feeds: BBC World, Al Jazeera (Reuters/AP-style major wire coverage). */
const DEFAULT_FEEDS = [
  "https://feeds.bbci.co.uk/news/world/rss.xml",
  "https://www.aljazeera.com/xml/rss/all.xml",
];

const STRIKE_KEYWORDS = [
  "iran", "strike", "missile", "drone", "explosion", "attack", "tehran", "baghdad",
  "damascus", "houthi", "saudi", "uae", "yemen", "iraq", "syria", "gulf", "beirut",
  "dubai", "lebanon", "hezbollah",
];

function stripCdata(s) {
  if (typeof s !== "string") return "";
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1].trim() : s.replace(/<[^>]+>/g, "").trim();
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? stripCdata(m[1].trim()) : "";
}

function parseRssItems(xml) {
  const items = [];
  const itemBlocks = xml.split(/<item\s+/i).slice(1);
  for (const block of itemBlocks) {
    const end = block.indexOf("</item>");
    const inner = end >= 0 ? block.slice(0, end) : block;
    const title = extractTag(inner, "title");
    const link = extractTag(inner, "link") || (inner.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] || "");
    const desc = extractTag(inner, "description") || extractTag(inner, "content:encoded") || extractTag(inner, "summary");
    const pubDate = extractTag(inner, "pubDate") || extractTag(inner, "published") || extractTag(inner, "updated");
    if (title) items.push({ title, link, description: desc, pubDate });
  }
  const entryBlocks = xml.split(/<entry\s+/i).slice(1);
  for (const block of entryBlocks) {
    const end = block.indexOf("</entry>");
    const inner = end >= 0 ? block.slice(0, end) : block;
    const title = extractTag(inner, "title");
    const linkEl = inner.match(/<link[^>]*href=["']([^"']+)["']/i);
    const link = linkEl ? linkEl[1] : extractTag(inner, "link");
    const desc = extractTag(inner, "summary") || extractTag(inner, "content");
    const pubDate = extractTag(inner, "published") || extractTag(inner, "updated");
    if (title) items.push({ title, link, description: desc, pubDate });
  }
  return items;
}

function isRelevant(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  return STRIKE_KEYWORDS.some((k) => text.includes(k));
}

function createRssPoller(deps) {
  const { setStrikeNews, broadcast, sleep } = deps;
  const push = setStrikeNews
    ? (items) => setStrikeNews("rss", items)
    : (items) => broadcast({ type: "strike_news", ts: Date.now(), payload: items });
  const log = (...args) => console.log("[strikeNews:rss]", ...args);

  const feedUrls = (process.env.RSS_FEED_URLS || DEFAULT_FEEDS.join(","))
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  const seenIds = new Set();
  const MAX_SEEN = 300;

  async function fetchFeed(url) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssItems(xml);
  }

  async function pollOnce() {
    log("poll start");
    try {
      const all = [];
      for (const url of feedUrls) {
        try {
          const items = await fetchFeed(url);
          const domain = new URL(url).hostname.replace(/^www\./, "");
          for (const it of items) {
            if (!isRelevant(it.title, it.description || "")) continue;
            if (excludeIsrael({ title: it.title, description: it.description || "" })) continue;
            const id = `rss-${domain}-${(it.link || it.title).slice(0, 80).replace(/\W/g, "-")}`;
            if (seenIds.has(id)) continue;
            seenIds.add(id);
            if (seenIds.size > MAX_SEEN) {
              const arr = [...seenIds];
              seenIds.clear();
              arr.slice(-MAX_SEEN / 2).forEach((x) => seenIds.add(x));
            }
            const placeName = extractPlaceName(it.title, it.description || "");
            all.push({
              id,
              title: it.title,
              description: (it.description || "").slice(0, 500),
              url: it.link || "",
              publishedAt: it.pubDate || "",
              sourceName: domain,
              placeName: placeName || null,
            });
          }
          await sleep(300);
        } catch (e) {
          log("feed error", url, e?.message);
        }
      }

      if (all.length === 0) {
        log("no relevant articles");
        return;
      }
      log("raw articles", all.length);

      const withCoords = [];
      for (const a of all) {
        const placeName = a.placeName || (a.title || "").split(/[,-]/)[0]?.trim();
        if (!placeName) continue;
        const coords = await geocodePlace(placeName);
        if (coords) withCoords.push({ ...a, lat: coords.lat, lon: coords.lon });
        await sleep(200);
      }
      log("geocoded", withCoords.length, "of", all.length);
      if (withCoords.length > 0) {
        push(withCoords);
        log("broadcast", withCoords.length, "items");
      }
    } catch (e) {
      console.error("[strikeNews:rss] poll error:", e?.message || e);
    }
    log("poll done, next in", POLL_INTERVAL_MS / 60000, "min");
  }

  async function loop() {
    log("loop started, feeds:", feedUrls.length, "interval", POLL_INTERVAL_MS / 60000, "min");
    while (true) {
      await pollOnce();
      await sleep(POLL_INTERVAL_MS);
    }
  }

  return { pollOnce, loop };
}

module.exports = { createRssPoller };
