/**
 * Map raw OREF (from ingest) into domain AlertEvent.
 * All future modules consume domain types only; raw payload stays in ingest.
 */

import type { AlertEvent } from "./types";
import type { NormalizedOrefAlert, RawOrefPayload } from "../../ingest/oref";

export interface MapToAlertEventOptions {
  /** ISO datetime when the alert was received; defaults to now */
  receivedAt?: string;
}

/**
 * Map normalized OREF alert + raw payload to domain AlertEvent.
 * Use when you have already normalized (e.g. from ingest) and need domain shape.
 */
export function mapNormalizedToAlertEvent(
  normalized: NormalizedOrefAlert,
  rawPayload: RawOrefPayload,
  options?: MapToAlertEventOptions
): AlertEvent {
  const receivedAt = options?.receivedAt ?? new Date().toISOString();
  const settlements = (normalized.data ?? []).map((name, i) => ({
    name,
    alertTime: normalized.eventTime ?? undefined,
    orderIndex: i,
  }));
  return {
    id: normalized.id,
    receivedAt,
    category: rawPayload.cat != null ? String(rawPayload.cat) : "1",
    title: normalized.title,
    settlements,
    source: "oref",
    rawPayload,
  };
}

/**
 * Map raw OREF payload to AlertEvent via normalized shape.
 * Use when you only have raw payload (e.g. in tests or replay); normalizes then maps.
 */
export function mapRawOrefToAlertEvent(
  rawPayload: RawOrefPayload,
  normalized: NormalizedOrefAlert,
  options?: MapToAlertEventOptions
): AlertEvent {
  return mapNormalizedToAlertEvent(normalized, rawPayload, options);
}
