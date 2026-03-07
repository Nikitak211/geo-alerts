const { normalizeAreaName } = require("../utils/normalize");

/**
 * Get a single alert time from payload. Never use "now" for settlement
 * (that would mark all bets as lost against current time).
 * Supports: datetime (ISO), alertTime, date+time (DD.MM.YYYY + HH:MM), alertDate (if full ISO).
 */
function getAlertTimeFromPayload(payload) {
  if (!payload) return null;
  const dt = payload.datetime;
  if (dt && typeof dt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(dt)) {
    return dt;
  }
  const at = payload.alertTime;
  if (at && typeof at === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(at)) return at;
    if (payload.alertDate && /^\d{4}-\d{2}-\d{2}/.test(String(payload.alertDate))) {
      return `${payload.alertDate}T${at.replace(/^(\d{2}:\d{2}).*/, "$1:00")}`;
    }
  }
  const dateStr = payload.date;
  const timeStr = payload.time;
  if (dateStr && timeStr && typeof dateStr === "string" && typeof timeStr === "string") {
    const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      const t = timeStr.replace(/^(\d{2}:\d{2}).*/, "$1:00");
      return `${yyyy}-${mm}-${dd}T${t}`;
    }
  }
  if (payload.alertDate && typeof payload.alertDate === "string" && /^\d{4}-\d{2}-\d{2}T/.test(payload.alertDate)) {
    return payload.alertDate;
  }
  return null;
}

/**
 * Oref payload shape can vary.
 * We only extract alerts when we have a valid alert time from the payload;
 * never use "now" so we don't settle with current time and mark everyone lost.
 */
function extractAlerts(payload) {
  const alerts = [];
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

module.exports = { extractAlerts, getAlertTimeFromPayload };
