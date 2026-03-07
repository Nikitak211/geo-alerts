/**
 * Dedupe by payload hash: emit only when payload content changes (same as current poller).
 */

import * as crypto from "crypto";
import type { RawOrefPayload } from "./types";

export function hashPayload(payload: RawOrefPayload): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export interface DedupeState {
  lastHash: string | null;
}

/**
 * Returns true if this payload should be emitted (content changed since last time).
 * Updates state in place.
 */
export function shouldEmit(
  state: DedupeState,
  payload: RawOrefPayload
): { emit: boolean; nextHash: string } {
  const nextHash = hashPayload(payload);
  const emit = state.lastHash != null && state.lastHash !== nextHash;
  state.lastHash = nextHash;
  return { emit, nextHash };
}
