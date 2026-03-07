/**
 * OREF ingestion (execution order step 1): fetch, parse, dedupe, publish.
 * Raw OREF JSON is only used inside this module. See docs/EXECUTION_ORDER.md.
 */

export { fetchAlertsJson, OREF_URL, OREF_HEADERS } from "./orefClient";
export type { RawOrefPayload, NormalizedOrefAlert, OrefAreaAlert } from "./types";
export {
  getAlertTimeFromPayload,
  extractAlerts,
  orefToNormalizedAlert,
} from "./orefParser";
export { hashPayload, shouldEmit } from "./orefDedupe";
export type { DedupeState } from "./orefDedupe";
export { publishNormalizedAlert } from "./orefPublisher";
export type { OrefPublishCallbacks } from "./orefPublisher";
export { normalizeAreaName } from "./normalize";
