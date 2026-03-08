/**
 * Shared geocoding and place extraction for strike news (GDELT + Telegram).
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "geo-alerts-server/1.0";

const REGION_KEYWORDS = [
  "iran", "tehran", "saudi", "riyadh", "uae", "dubai", "yemen", "iraq", "syria",
  "baghdad", "damascus", "gulf", "houthi",
];

const KNOWN_PLACES = [
  "Tehran", "Isfahan", "Shiraz", "Tabriz", "Mashhad", "Qom", "Kermanshah", "Ahvaz", "Abadan",
  "Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Abu Dhabi", "Dubai", "Sharjah",
  "Baghdad", "Basra", "Erbil", "Damascus", "Aleppo", "Sana'a", "Aden", "Muscat",
];

function excludeIsrael(article) {
  const text = `${(article.title || "").toLowerCase()} ${(article.description || "").toLowerCase()}`;
  const hasIsrael = /\bisrael\b/.test(text);
  const hasRegion = REGION_KEYWORDS.some((k) => text.includes(k));
  if (hasIsrael && !hasRegion) return true;
  if (/\bstrike\s+in\s+israel\b|\bisraeli\s+strike\b|\brocket\s+.*\bisrael\b/i.test(article.title || "")) return true;
  return false;
}

function extractPlaceName(title, description) {
  const text = `${title} ${description}`;
  for (const place of KNOWN_PLACES) {
    if (new RegExp(place.replace("'", "'"), "i").test(text)) return place;
  }
  const inMatch = text.match(/\bin\s+([A-Za-z\u0600-\u06FF\s'-]+?)(?:\s*[,.]|\s+on\s+|\s+strike|$)/i);
  if (inMatch) {
    const name = inMatch[1].trim();
    if (name.length >= 2 && name.length < 50) return name;
  }
  const commaMatch = (title || "").match(/^([A-Za-z\u0600-\u06FF\s'-]+?),?\s+(?:Iran|Saudi|UAE|Iraq|Syria|Yemen)/i);
  if (commaMatch) {
    const name = commaMatch[1].trim();
    if (name.length >= 2 && name.length < 50) return name;
  }
  return null;
}

async function geocodePlace(place) {
  if (!place || !place.trim()) return null;
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(place.trim())}&format=jsonv2&limit=1`;
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  const arr = Array.isArray(data) ? data : [];
  const first = arr[0];
  if (!first || first.lat == null || first.lon == null) return null;
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

module.exports = {
  NOMINATIM_URL,
  USER_AGENT,
  REGION_KEYWORDS,
  KNOWN_PLACES,
  excludeIsrael,
  extractPlaceName,
  geocodePlace,
};
