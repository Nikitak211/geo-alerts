export type MapTileConfig = {
  provider: "stadia" | "openstreetmap";
  url: string;
  attribution: string;
  maximumLevel: number;
};

const OPENSTREETMAP_URL =
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const STADIA_URL =
  "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png";

export const OPENSTREETMAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

const STADIA_ATTRIBUTION =
  '© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

export function resolveMapTiles(stadiaApiKey?: string): MapTileConfig {
  const normalizedKey = stadiaApiKey?.trim();

  if (!normalizedKey) {
    return {
      provider: "openstreetmap",
      url: OPENSTREETMAP_URL,
      attribution: OPENSTREETMAP_ATTRIBUTION,
      maximumLevel: 19,
    };
  }

  return {
    provider: "stadia",
    url: `${STADIA_URL}?api_key=${encodeURIComponent(normalizedKey)}`,
    attribution: STADIA_ATTRIBUTION,
    maximumLevel: 20,
  };
}

export const configuredMapTiles = resolveMapTiles(
  process.env.REACT_APP_STADIA_MAPS_API_KEY,
);

export const fallbackMapTiles = resolveMapTiles();
