/**
 * OREF polling loop: calls ingest/oref (step 1) only. No fetch/parse logic here.
 */
const path = require("path");
const ingest = require(path.join(__dirname, "../../dist/ingest/oref"));

function createOrefPoller(deps) {
  const {
    broadcast,
    processAlertPayload,
    sleep,
    resolvePlacesAndBroadcast,
    onAlertReady,
    fetchAlertsJson,
    pollIntervalMs = 3000,
  } = deps;

  const getJson = typeof fetchAlertsJson === "function" ? fetchAlertsJson : ingest.fetchAlertsJson;
  const dedupeState = { lastHash: null };

  async function pollOnce() {
    const json = await getJson();
    if (!json) return;
    const { emit } = ingest.shouldEmit(dedupeState, json);
    if (!emit) return;

    const normalized = ingest.orefToNormalizedAlert(json);
    if (!normalized) return;

    await ingest.publishNormalizedAlert(normalized, json, {
      onBroadcastRaw(raw) {
        broadcast({
          type: "oref_update",
          ts: Date.now(),
          payload: raw,
        });
      },
      async onResolvePlaces(placeNames) {
        if (
          resolvePlacesAndBroadcast &&
          Array.isArray(placeNames) &&
          placeNames.length > 0
        ) {
          await resolvePlacesAndBroadcast(placeNames);
        }
      },
      async onPersist(_normalized, rawPayload) {
        const settlementResults = await processAlertPayload(rawPayload);
        console.log("[oref] settlementResults length:", settlementResults.length);
        if (settlementResults.length) {
          console.log("settlementResults:", settlementResults);
        }
      },
    });
    if (onAlertReady && normalized) {
      try {
        onAlertReady(normalized, json);
      } catch (e) {
        console.error("[oref] onAlertReady error:", e?.message ?? e);
      }
    }
  }

  async function loop() {
    while (true) {
      try {
        await pollOnce();
        await sleep(pollIntervalMs);
      } catch (e) {
        console.error("poll error:", e?.message ?? e);
        await sleep(5000);
      }
    }
  }

  return { pollOnce, loop };
}

module.exports = { createOrefPoller };
