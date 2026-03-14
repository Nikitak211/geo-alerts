/**
 * Canonical app-level models for alerts and inference.
 * All future modules consume these types only (no raw OREF outside ingest).
 */

/** [longitude, latitude] — GeoJSON order */
export type LonLat = [number, number];

/** Reference to a settlement by name (before geo resolution) */
export interface AlertSettlementRef {
  name: string;
  /** Optional alert time (ISO) when event occurred */
  alertTime?: string;
  orderIndex?: number;
}

/** Resolved settlement with coordinates and optional polygon */
export interface SettlementGeoMatch {
  name: string;
  lat: number;
  lon: number;
  polygonId?: string | null;
  confidence: number;
}

/** Normalized alert event (from OREF or replay) */
export interface AlertEvent {
  id: string;
  receivedAt: string;
  category: string;
  title: string;
  settlements: AlertSettlementRef[];
  source: "oref" | "replay";
  /** Raw payload from source (e.g. RawOrefPayload when source is "oref") */
  rawPayload?: unknown;
}

/** Impact cluster from matched settlements */
export interface AlertCluster {
  alertId: string;
  centroid: LonLat;
  bbox: [number, number, number, number];
  hull: LonLat[][] | null;
  radiusKm: number;
  matchedSettlements: SettlementGeoMatch[];
}

/** Reverse launch corridor (Israel → Iran direction) */
export interface ReverseCorridor {
  startPoint: LonLat;
  endPoint: LonLat;
  centerBearingDeg: number;
  spreadDeg: number;
  maxDistanceKm: number;
  polygon: LonLat[][];
}

/** GeoJSON polygon (array of linear rings) */
export type GeoPolygon = number[][][];

/** GeoJSON multi-polygon */
export type GeoMultiPolygon = number[][][][];

/** Candidate launch region (approximate, not exact point) */
export interface CandidateLaunchArea {
  id: string;
  name: string;
  type: string;
  geometry:
    | { type: "Polygon"; coordinates: GeoPolygon }
    | { type: "MultiPolygon"; coordinates: GeoMultiPolygon };
  metadata?: Record<string, unknown>;
}

/** Score for one candidate */
export interface CandidateScore {
  candidateId: string;
  score: number;
  distanceKm: number;
  bearingDelta: number;
  corridorOverlap: number;
  confidence: number;
  reasons: string[];
}

/** Full inference result */
export interface InferenceResult {
  alertId: string;
  algorithmVersion: string;
  cluster: AlertCluster;
  corridor: ReverseCorridor;
  rankedCandidates: CandidateScore[];
  summary: {
    confidence: "high" | "medium" | "low";
    /** Human-readable confidence label (from confidence bands). */
    confidenceLabel?: string;
    estimatedLaunchRegion?: string;
  };
}
