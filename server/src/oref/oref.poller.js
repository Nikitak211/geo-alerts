const crypto = require("crypto");

const hash = (obj) =>
  crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");

function createOrefPoller(deps) {
  const {
    fetchAlertsJson,
    broadcast,
    processAlertPayload,
    sleep,
    resolvePlacesAndBroadcast,
  } = deps;

  let lastHash = null;

  async function pollOnce() {
    const json = await fetchAlertsJson();
    if (!json) return;
    const h = hash(json);
    if (lastHash && h !== lastHash) {
      broadcast({
        type: "oref_update",
        ts: Date.now(),
        payload: json,
      });
      if (resolvePlacesAndBroadcast && Array.isArray(json?.data) && json.data.length > 0) {
        resolvePlacesAndBroadcast(json.data);
      }
      const settlementResults = await processAlertPayload(json);
      if (settlementResults.length) {
        console.log("settlementResults:", settlementResults);
      }
    }
    lastHash = h;
  }

  async function loop() {
    while (true) {
      try {
        await pollOnce();
        await sleep(3000);
      } catch (e) {
        console.error("poll error:", e?.message ?? e);
        await sleep(5000);
      }
    }
  }

  return { pollOnce, loop };
}

module.exports = { createOrefPoller, hash };
