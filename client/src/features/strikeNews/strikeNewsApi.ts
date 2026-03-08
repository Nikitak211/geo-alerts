/**
 * Fetch news about strikes in Iran, Saudi, UAE, and region. Exclude Israel-focused articles.
 * Uses GNews API (gnews.io) when REACT_APP_GNEWS_API_KEY is set.
 */

import type { StrikeNewsArticle } from "./types";

const GNEWS_BASE = "https://gnews.io/api/v4/search";
const USER_AGENT = "geo-alerts/1.0";

/** Region keywords: keep articles that mention these. */
const REGION_KEYWORDS = ["iran", "tehran", "saudi", "riyadh", "uae", "dubai", "yemen", "iraq", "syria", "baghdad", "damascus", "gulf", "houthi"];

/** Exclude articles that are mainly about Israel (strikes in Israel, not on Iran/region). */
function excludeIsrael(article: { title: string; description?: string }): boolean {
  const text = `${(article.title || "").toLowerCase()} ${(article.description || "").toLowerCase()}`;
  const hasIsrael = /\bisrael\b/.test(text);
  const hasRegion = REGION_KEYWORDS.some((k) => text.includes(k));
  if (hasIsrael && !hasRegion) return true;
  if (/\bstrike\s+in\s+israel\b|\bisraeli\s+strike\b|\brocket\s+.*\bisrael\b/i.test(article.title || "")) return true;
  return false;
}

/** Extract a likely place name from title/description (simple: known cities or "in X" / "X,"). */
const KNOWN_PLACES = [
  "Tehran", "Isfahan", "Shiraz", "Tabriz", "Mashhad", "Qom", "Kermanshah", "Ahvaz", "Abadan",
  "Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Abu Dhabi", "Dubai", "Sharjah",
  "Baghdad", "Basra", "Erbil", "Damascus", "Aleppo", "Sana'a", "Aden", "Muscat",
];
function extractPlaceName(title: string, description: string): string | null {
  const text = `${title} ${description}`;
  for (const place of KNOWN_PLACES) {
    if (new RegExp(place.replace("'", "'"), "i").test(text)) return place;
  }
  const inMatch = text.match(/\bin\s+([A-Za-z\u0600-\u06FF\s'-]+?)(?:\s*[,.]|\s+on\s+|\s+strike|$)/i);
  if (inMatch) {
    const name = inMatch[1].trim();
    if (name.length >= 2 && name.length < 50) return name;
  }
  const commaMatch = title.match(/^([A-Za-z\u0600-\u06FF\s'-]+?),?\s+(?:Iran|Saudi|UAE|Iraq|Syria|Yemen)/i);
  if (commaMatch) {
    const name = commaMatch[1].trim();
    if (name.length >= 2 && name.length < 50) return name;
  }
  return null;
}

type GNewsItem = {
  title: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  source?: { name?: string };
  content?: string;
};

export async function fetchStrikeNews(signal?: AbortSignal): Promise<StrikeNewsArticle[]> {
  const apiKey = typeof process !== "undefined" && (process as any).env?.REACT_APP_GNEWS_API_KEY;
  if (!apiKey) return [];

  const query = "Iran strike OR strike Iran OR Saudi strike OR UAE strike OR Yemen strike OR Iraq strike";
  const url = `${GNEWS_BASE}?q=${encodeURIComponent(query)}&token=${apiKey}&lang=en&max=20`;
  const res = await fetch(url, { signal, headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];

  const data = (await res.json()) as { articles?: GNewsItem[] };
  const articles = Array.isArray(data?.articles) ? data.articles : [];
  const out: StrikeNewsArticle[] = [];
  const seen = new Set<string>();

  for (const a of articles) {
    if (excludeIsrael(a)) continue;
    const title = (a.title || "").trim();
    if (!title || seen.has(title)) continue;
    seen.add(title);
    const placeName = extractPlaceName(title, a.description || a.content || "");
    out.push({
      id: `strike-${out.length}-${title.slice(0, 40).replace(/\s/g, "-")}`,
      title,
      description: (a.description || a.content || "").trim(),
      url: a.url || "",
      publishedAt: a.publishedAt || "",
      sourceName: a.source?.name || "",
      placeName: placeName || null,
    });
  }
  return out;
}
