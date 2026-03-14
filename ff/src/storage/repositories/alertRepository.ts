/**
 * Persist raw alert, normalized alert, and settlement matches for replay/debugging.
 */

import type { Pool } from "pg";
import type { NormalizedOrefAlert } from "../../ingest/oref/types";
import type { SettlementGeoMatch } from "../../domain/alerts/types";

export interface PersistAlertRow {
  id: string;
  rawPayload: unknown;
  normalizedAlert: NormalizedOrefAlert;
  /** When the alert was received (for replay). */
  receivedAt?: string;
  settlementMatches: SettlementGeoMatch[] | null;
}

/**
 * Insert or replace pipeline alert (raw, normalized, receivedAt, settlement matches).
 */
export async function persistAlert(
  pool: Pool,
  row: PersistAlertRow
): Promise<void> {
  const receivedAt = row.receivedAt ?? new Date().toISOString();
  await pool.query(
    `INSERT INTO pipeline_alerts (id, raw_payload, normalized_alert, received_at, settlement_matches)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       raw_payload = EXCLUDED.raw_payload,
       normalized_alert = EXCLUDED.normalized_alert,
       received_at = EXCLUDED.received_at,
       settlement_matches = EXCLUDED.settlement_matches`,
    [
      row.id,
      JSON.stringify(row.rawPayload ?? {}),
      JSON.stringify(row.normalizedAlert),
      receivedAt,
      row.settlementMatches ? JSON.stringify(row.settlementMatches) : null,
    ]
  );
}

/**
 * Get pipeline alert by id for replay.
 */
export async function getAlertById(
  pool: Pool,
  id: string
): Promise<PersistAlertRow | null> {
  const res = await pool.query(
    `SELECT id, raw_payload, normalized_alert, received_at, settlement_matches
     FROM pipeline_alerts WHERE id = $1`,
    [id]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    rawPayload: row.raw_payload,
    normalizedAlert: row.normalized_alert as NormalizedOrefAlert,
    receivedAt: row.received_at ? new Date(row.received_at).toISOString() : undefined,
    settlementMatches: row.settlement_matches as SettlementGeoMatch[] | null,
  };
}

/**
 * Update settlement matches for an existing pipeline alert (after inference).
 */
export async function updateAlertSettlementMatches(
  pool: Pool,
  id: string,
  settlementMatches: SettlementGeoMatch[]
): Promise<void> {
  await pool.query(
    `UPDATE pipeline_alerts SET settlement_matches = $2 WHERE id = $1`,
    [id, JSON.stringify(settlementMatches)]
  );
}

export interface AlertListItem {
  id: string;
  receivedAt: string;
}

/**
 * List pipeline alert ids and received_at in a date range (for replay).
 */
export async function listAlertsByDateRange(
  pool: Pool,
  fromInclusive: string,
  toInclusive: string
): Promise<AlertListItem[]> {
  const res = await pool.query(
    `SELECT id, received_at FROM pipeline_alerts
     WHERE received_at >= $1::timestamptz AND received_at <= $2::timestamptz
     ORDER BY received_at ASC`,
    [fromInclusive, toInclusive]
  );
  return res.rows.map((row) => ({
    id: row.id,
    receivedAt: row.received_at ? new Date(row.received_at).toISOString() : "",
  }));
}
