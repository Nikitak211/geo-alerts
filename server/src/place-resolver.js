/**
 * Resolve many places to GeoBoxes: GeoJSON first (fast), then Nominatim for misses (throttled).
 * Used to broadcast place_positions over WS so the client doesn't need 50 HTTP requests.
 */

const { lookupGeoBox } = require("./geojson-lookup");

/** Overrides for places that GeoJSON/Nominatim resolve incorrectly (e.g. ג'ת→קריית גת). */
const PLACE_OVERRIDES = {
  "ג'ת": {
    place: "ג'ת",
    bbox: [32.35, 32.45, 35.0, 35.08],
    center: { lat: 32.3984, lon: 35.03558 },
    displayName: "ג'ת (Jatt)",
    title: "ג'ת",
  },
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const CONCURRENCY = 4;

async function fetchOneNominatim(place) {
  const url =
    `${NOMINATIM_URL}?q=${encodeURIComponent(place)}` +
    "&format=jsonv2&limit=1&addressdetails=1&accept-language=he,en&countrycodes=il,ps";
  const r = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "geo-alerts-server/1.0" },
  });
  if (!r.ok) return null;
  const data = await r.json();
  const first = Array.isArray(data) && data.length ? data[0] : null;
  if (!first || first.lat == null || first.lon == null) return null;
  const bbox = first.boundingbox;
  return {
    place: String(place),
    bbox: Array.isArray(bbox) && bbox.length >= 4 ? bbox.map(Number) : [0, 0, 0, 0],
    center: { lat: Number(first.lat), lon: Number(first.lon) },
    displayName: first.display_name,
    title: String(place),
  };
}

async function resolvePlacesToGeoBoxes(placeNames, geojsonPath) {
  const result = {};
  const misses = [];
  for (const place of placeNames) {
    const name = typeof place === "string" ? place.trim() : "";
    if (!name) continue;
    const override = PLACE_OVERRIDES[name];
    if (override) {
      result[name] = override;
      continue;
    }
    const fromGeo = lookupGeoBox(name, geojsonPath);
    if (fromGeo) {
      result[name] = fromGeo;
    } else {
      misses.push(name);
    }
  }
  if (misses.length === 0) return result;
  let idx = 0;
  const run = async () => {
    while (idx < misses.length) {
      const place = misses[idx++];
      try {
        const geo = await fetchOneNominatim(place);
        if (geo) result[place] = geo;
      } catch (_) {
        // skip
      }
    }
  };
  const workers = Array.from({ length: Math.min(CONCURRENCY, misses.length) }, () => run());
  await Promise.all(workers);
  return result;
}

module.exports = { resolvePlacesToGeoBoxes };
