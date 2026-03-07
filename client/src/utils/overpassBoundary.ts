/**
 * Fetch OSM administrative boundary polygon for a place in Israel (Overpass API).
 * Returns GeoJSON-style coordinates so the polygon can be drawn on the map or exported.
 */

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const IL_BBOX = [29.45, 34.22, 33.35, 35.88]; // south, west, north, east

function escapeOverpassRegex(s: string): string {
  return s.replace(/([.*+?^${}()|[\]\\])/g, "\\$1").trim();
}

export type OverpassPolygonResult = {
  displayName: string;
  /** GeoJSON Polygon coordinates: [ outer ring ], outer ring = [ [lon, lat], ... ] */
  coordinates: number[][][];
};

/**
 * Fetch boundary relation for a place in Israel. Returns polygon coordinates (lon, lat)
 * and display name, or null if not found.
 */
export async function fetchOverpassBoundaryPolygon(
  place: string,
  signal?: AbortSignal,
): Promise<OverpassPolygonResult | null> {
  const escaped = escapeOverpassRegex(place);
  if (!escaped) return null;

  const q = `[out:json][timeout:15];
(
  relation["boundary"="administrative"](${IL_BBOX.join(",")})["name"~"${escaped}",i];
  relation["boundary"="administrative"](${IL_BBOX.join(",")})["name:he"~"${escaped}"];
);
out geom;`;

  const res = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(q)}`,
    signal,
  });

  if (!res.ok) return null;

  const json = await res.json();
  const elements = json?.elements ?? [];
  const withGeom = elements.filter(
    (e: { geometry?: { lat: number; lon: number }[] }) =>
      e.geometry && Array.isArray(e.geometry) && e.geometry.length > 0,
  );
  if (withGeom.length === 0) return null;

  const first = withGeom[0];
  const geom = first.geometry as { lat: number; lon: number }[];
  const ring = geom.map((p) => [p.lon, p.lat] as [number, number]);
  if (ring.length < 3) return null;
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
    ring.push([ring[0][0], ring[0][1]]);
  }
  const displayName = first.tags?.name ?? first.tags?.["name:he"] ?? place;

  return {
    displayName,
    coordinates: [ring],
  };
}
