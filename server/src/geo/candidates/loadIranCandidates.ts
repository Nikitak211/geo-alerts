/**
 * Load Iran candidate launch regions from GeoJSON.
 * Data-driven; no single hardcoded launch coordinate.
 */

import * as fs from "fs";
import * as path from "path";
import type { IranCandidateFeature } from "./types";
import type { GeoPolygon, GeoMultiPolygon } from "../../domain/alerts/types";

interface GeoFeature {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry?: {
    type: "Polygon";
    coordinates: GeoPolygon;
  } | {
    type: "MultiPolygon";
    coordinates: GeoMultiPolygon;
  };
}

interface FeatureCollection {
  type: "FeatureCollection";
  features?: GeoFeature[];
}

export interface LoadIranCandidatesOptions {
  /** Path to iran_candidate_regions.geojson. Defaults to src/data/iran/ or data/iran/ under cwd. */
  dataPath?: string;
}

const DEFAULT_PATH = path.join(
  process.cwd(),
  "src",
  "data",
  "iran",
  "iran_candidate_regions.geojson"
);
const FALLBACK_PATH = path.join(
  process.cwd(),
  "data",
  "iran",
  "iran_candidate_regions.geojson"
);

/**
 * Load candidate regions from GeoJSON. Returns features with id, name, type, priority, geometry.
 * Inference engine can query these as polygons (intersect with corridor, etc.).
 */
export function loadIranCandidates(
  options?: LoadIranCandidatesOptions
): IranCandidateFeature[] {
  const dataPath =
    options?.dataPath ??
    (fs.existsSync(DEFAULT_PATH) ? DEFAULT_PATH : FALLBACK_PATH);

  if (!fs.existsSync(dataPath)) {
    return [];
  }

  let raw: string;
  try {
    raw = fs.readFileSync(dataPath, "utf8");
  } catch {
    return [];
  }

  let fc: FeatureCollection;
  try {
    fc = JSON.parse(raw);
  } catch {
    return [];
  }

  const features = fc?.features;
  if (!Array.isArray(features)) return [];

  const out: IranCandidateFeature[] = [];

  for (const f of features) {
    if (f?.type !== "Feature" || !f.geometry) continue;
    const props = f.properties ?? {};
    const id = typeof props.id === "string" ? props.id : String(props.id ?? "");
    const name = typeof props.name === "string" ? props.name : id;
    const type = typeof props.type === "string" ? props.type : "sector";
    const priority =
      typeof props.priority === "number" && Number.isFinite(props.priority)
        ? props.priority
        : 999;

    if (f.geometry.type === "Polygon") {
      out.push({
        id,
        name,
        type,
        priority,
        geometry: { type: "Polygon", coordinates: f.geometry.coordinates },
        metadata: { ...props },
      });
    } else if (f.geometry.type === "MultiPolygon") {
      out.push({
        id,
        name,
        type,
        priority,
        geometry: { type: "MultiPolygon", coordinates: f.geometry.coordinates },
        metadata: { ...props },
      });
    }
  }

  out.sort((a, b) => a.priority - b.priority);
  return out;
}
