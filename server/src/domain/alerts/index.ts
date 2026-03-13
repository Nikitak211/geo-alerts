/**
 * Domain alerts (execution order step 2): canonical types and OREF → AlertEvent mappers.
 * See docs/EXECUTION_ORDER.md.
 */

export type {
  LonLat,
  AlertSettlementRef,
  SettlementGeoMatch,
  AlertEvent,
  AlertCluster,
  ReverseCorridor,
  GeoPolygon,
  GeoMultiPolygon,
  CandidateLaunchArea,
  CandidateScore,
  InferenceResult,
} from "./types";
export {
  mapNormalizedToAlertEvent,
  mapRawOrefToAlertEvent,
} from "./mappers";
export type { MapToAlertEventOptions } from "./mappers";
