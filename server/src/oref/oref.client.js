const OREF_URL =
  "https://www.oref.org.il/WarningMessages/alert/alerts.json";

const OREF_HEADERS = {
  Referer: "https://www.oref.org.il/",
  "X-Requested-With": "XMLHttpRequest",
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
};

async function fetchAlertsJson() {
  const res = await fetch(OREF_URL, {
    method: "GET",
    headers: OREF_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text || text.trim() === "") return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("OREF JSON parse failed:", e?.message ?? e);
    return null;
  }
}

module.exports = {
  OREF_URL,
  OREF_HEADERS,
  fetchAlertsJson,
};
