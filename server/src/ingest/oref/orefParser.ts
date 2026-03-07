/**
 * Parse raw OREF payload: normalize date/time and produce normalized alert + area alerts.
 * Never use "now" for event time (settlement must use payload time).
 */

import * as crypto from "crypto";
import type { RawOrefPayload, NormalizedOrefAlert, OrefAreaAlert } from "./types";
import { normalizeAreaName } from "./normalize";

/**
 * Get a single alert time from payload. Supports:
 * - datetime (ISO)
 * - alertTime + alertDate
 * - date (DD.MM.YYYY) + time (HH:MM)
 * - alertDate (if full ISO)
 */
export function getAlertTimeFromPayload(
  payload: RawOrefPayload | null
): string | null {
  if (!payload) return null;
  const dt = payload.datetime;
  if (dt && typeof dt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(dt)) {
    return dt;
  }
  const at = payload.alertTime;
  if (at && typeof at === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(at)) return at;
    if (
      payload.alertDate &&
      /^\d{4}-\d{2}-\d{2}/.test(String(payload.alertDate))
    ) {
      return `${payload.alertDate}T${at.replace(/^(\d{2}:\d{2}).*/, "$1:00")}`;
    }
  }
  const dateStr = payload.date;
  const timeStr = payload.time;
  if (
    dateStr &&
    timeStr &&
    typeof dateStr === "string" &&
    typeof timeStr === "string"
  ) {
    const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      const t = timeStr.replace(/^(\d{2}:\d{2}).*/, "$1:00");
      return `${yyyy}-${mm}-${dd}T${t}`;
    }
  }
  if (
    payload.alertDate &&
    typeof payload.alertDate === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(payload.alertDate)
  ) {
    return payload.alertDate;
  }
  return null;
}

/**
 * Extract area alerts (areaHeb + alertTime). Only when we have a valid alert time.
 */
export function extractAlerts(
  payload: RawOrefPayload | null
): OrefAreaAlert[] {
  const alerts: OrefAreaAlert[] = [];
  if (!payload) return alerts;
  const alertTime = getAlertTimeFromPayload(payload);
  if (!alertTime) return alerts;
  if (Array.isArray(payload.data)) {
    for (const rawArea of payload.data) {
      const areaHeb = normalizeAreaName(rawArea);
      if (areaHeb) {
        alerts.push({ areaHeb, alertTime });
      }
    }
  }
  return alerts;
}

/**
 * Convert raw OREF payload to normalized alert for broadcast/persistence.
 * Id is stable from eventTime + data.
 */
export function orefToNormalizedAlert(
  payload: RawOrefPayload | null
): NormalizedOrefAlert | null {
  if (!payload) return null;
  const eventTime = getAlertTimeFromPayload(payload);
  const data = Array.isArray(payload.data)
    ? payload.data.map((a) => (typeof a === "string" ? a : String(a)))
    : [];
  const title =
    typeof payload.title === "string"
      ? payload.title
      : payload.data?.length
        ? "alert"
        : "";
  const id = crypto
    .createHash("sha256")
    .update(JSON.stringify({ eventTime, data }))
    .digest("hex")
    .slice(0, 16);
  return { id, title, data, eventTime: eventTime ?? null };
}
