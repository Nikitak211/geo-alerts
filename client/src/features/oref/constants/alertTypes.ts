/**
 * OREF alert type and event constants.
 */

export const AlertTypes = {
  Rockets: "ירי רקטות וטילים",
} as const;

export type AlertTypeValue = (typeof AlertTypes)[keyof typeof AlertTypes];

export const OrefEventTypes = {
  OrefUpdate: "oref_update",
  PlacePositions: "place_positions",
  Hello: "hello",
  /** Server broadcast after running inference on new alert (cluster, corridor, top candidates). */
  InferenceResult: "inference_result",
} as const;

export type OrefEventType = (typeof OrefEventTypes)[keyof typeof OrefEventTypes];

/** Title used for trajectory eligibility. */
export const ROCKET_ALERT_TITLE = AlertTypes.Rockets;

export const OREF_UPDATE = OrefEventTypes.OrefUpdate;
