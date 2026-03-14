function getAlertDateParts(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return { yyyy, mm, dd, dateStr: `${yyyy}-${mm}-${dd}` };
}

function parsePredictedTimestampLocal(betDate, predictedTime) {
  const t = String(predictedTime || "").trim().slice(0, 5);
  const timePart = /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : "00:00:00";
  return new Date(`${toDateOnlyString(betDate)}T${timePart}`);
}

function toDateOnlyString(value) {
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s.slice(0, 10);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  getAlertDateParts,
  parsePredictedTimestampLocal,
  toDateOnlyString,
  sleep,
};
