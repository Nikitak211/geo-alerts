/**
 * Geocode a place name (Iran, Saudi, UAE, etc.) via server /api/geocode/global.
 */

const API_BASE =
  (typeof process !== "undefined" && (process as any).env?.REACT_APP_API_BASE) ||
  "http://localhost:8090";

type NominatimResult = { lat: string; lon: string; display_name?: string };

export async function geocodeStrikePlace(
  place: string,
  signal?: AbortSignal
): Promise<{ lat: number; lon: number } | null> {
  if (!place.trim()) return null;
  const url = `${API_BASE}/api/geocode/global?place=${encodeURIComponent(place.trim())}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  const arr = Array.isArray(data) ? data : [];
  const first = arr[0] as NominatimResult | undefined;
  if (!first?.lat || !first?.lon) return null;
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}
