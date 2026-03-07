/**
 * Persist screenshot metadata for replay/debugging.
 */

import type { Pool } from "pg";

export interface PersistScreenshotRow {
  alertId: string;
  path: string;
  url: string | null;
  createdAt: string;
  width: number;
  height: number;
  theme: string;
  algorithmVersion: string;
}

/**
 * Insert screenshot metadata.
 */
export async function persistScreenshot(
  pool: Pool,
  row: PersistScreenshotRow
): Promise<number> {
  const res = await pool.query(
    `INSERT INTO screenshot_metadata (alert_id, path, url, created_at, width, height, theme, algorithm_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      row.alertId,
      row.path,
      row.url ?? null,
      row.createdAt,
      row.width,
      row.height,
      row.theme,
      row.algorithmVersion,
    ]
  );
  return res.rows[0]?.id;
}

/**
 * Get latest screenshot metadata by alert id.
 */
export async function getScreenshotByAlertId(
  pool: Pool,
  alertId: string
): Promise<(PersistScreenshotRow & { id: number }) | null> {
  const res = await pool.query(
    `SELECT id, alert_id, path, url, created_at, width, height, theme, algorithm_version
     FROM screenshot_metadata WHERE alert_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [alertId]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    alertId: row.alert_id,
    path: row.path,
    url: row.url,
    createdAt: row.created_at,
    width: row.width,
    height: row.height,
    theme: row.theme,
    algorithmVersion: row.algorithm_version,
  };
}
