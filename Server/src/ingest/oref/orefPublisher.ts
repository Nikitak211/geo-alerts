/**
 * Publish step: given normalized alert + raw payload, call broadcast, persist, resolve.
 * Callbacks are injected by the server so ingest stays free of WS/DB.
 */

import type { NormalizedOrefAlert, RawOrefPayload } from "./types";

export interface OrefPublishCallbacks {
  /** Broadcast raw payload to WS (preserves current client behavior). */
  onBroadcastRaw?: (rawPayload: RawOrefPayload) => void;
  /** Optional: broadcast normalized alert. */
  onBroadcast?: (normalized: NormalizedOrefAlert) => void;
  onPersist?: (
    normalized: NormalizedOrefAlert,
    rawPayload: RawOrefPayload
  ) => void | Promise<void>;
  onResolvePlaces?: (
    placeNames: string[],
    alertId: string
  ) => void | Promise<void>;
}

/**
 * Run publish step: resolve places first, broadcast place_positions, then oref_update.
 * Client needs place_positions before oref_update to render icons and trajectory.
 */
export async function publishNormalizedAlert(
  normalized: NormalizedOrefAlert,
  rawPayload: RawOrefPayload,
  callbacks: OrefPublishCallbacks
): Promise<void> {
  const placeNames = Array.isArray(rawPayload.data) ? rawPayload.data : [];
  if (placeNames.length > 0) {
    await callbacks.onResolvePlaces?.(placeNames, normalized.id);
  }
  callbacks.onBroadcastRaw?.(rawPayload);
  callbacks.onBroadcast?.(normalized);
  await callbacks.onPersist?.(normalized, rawPayload);
}
