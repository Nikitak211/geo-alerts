/**
 * OREF trajectory feature — public API.
 * Layers: ingestion → normalization → eligibility → trajectory math → border corridor → rendering.
 */

export {
  AlertPinsLayer,
  AlertTrajectoryLayer,
  AlertTrajectoryDebugLayer,
  IranBorderLayer,
  IrBasesLayer,
} from "./components";
export { OrefTrajectoryProvider, useOrefTrajectory } from "./context/OrefTrajectoryContext";
export { useOrefAlerts, useTrajectoryAlerts } from "./hooks";
export { ROCKET_ALERT_TITLE, OREF_UPDATE } from "./constants/alertTypes";
export type {
  OrefNormalizedAlert,
  TrajectoryInput,
  TrajectoryResult,
  OrefAlert,
  GeoPoint,
} from "./types/oref.types";
export type { RawOrefPayload } from "./hooks/useOrefAlerts";
export type { TrajectoryAlertState } from "./hooks/useTrajectoryAlerts";

export { solveProximity } from "./utils/solveProximity";
export { israelAoiBoundaries } from "./utils/proximityBoundaries";
export type {
  ProximityResult,
  AlertPlace,
  ApproachSide,
  BoundarySet,
  LonLat,
} from "./utils/proximityTypes";
