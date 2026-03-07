const express = require("express");
const { pool } = require("./db/pool");
const { createWsServer } = require("./ws/ws.server");
const {
  hashPassword,
  requireUser,
} = require("./auth/auth.service");
const { normalizeEmail } = require("./utils/normalize");
const {
  getOrCreateUserWallet,
  buildWalletResponseRow,
} = require("./wallet/wallet.service");
const { insertLedger } = require("./wallet/wallet.ledger");
const { sleep } = require("./utils/time");
const { fetchAlertsJson } = require("./oref/oref.client");
const { createSettlementService } = require("./bets/settlement.service");
const { createExpiryService } = require("./bets/expiry.service");
const { createBetsService } = require("./bets/bets.service");
const { createOrefPoller } = require("./oref/oref.poller");
const { mountAuthRoutes } = require("./auth/auth.routes");
const { mountWalletRoutes } = require("./wallet/wallet.routes");
const { mountBetsRoutes } = require("./bets/bets.routes");

const PORT = Number(process.env.PORT || 8080);
const HTTP_PORT = Number(process.env.HTTP_PORT || 8090);

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, x-user-id");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const { wss, broadcast } = createWsServer(PORT);

const settlementService = createSettlementService({
  pool,
  broadcast,
  getOrCreateUserWallet,
  insertLedger,
});
const { processAlertPayload } = settlementService;

const expiryService = createExpiryService({
  pool,
  broadcast,
  getOrCreateUserWallet,
  insertLedger,
});
const { expireMissedBets } = expiryService;

const betsService = createBetsService({
  pool,
  getOrCreateUserWallet,
  insertLedger,
});

const orefPoller = createOrefPoller({
  fetchAlertsJson,
  broadcast,
  processAlertPayload,
  sleep,
  resolvePlacesAndBroadcast: (placeNames) => {
    if (!Array.isArray(placeNames) || placeNames.length === 0) return;
    resolvePlacesToGeoBoxes(placeNames, GEOJSON_LOOKUP_PATH).then((boxes) => {
      broadcast({ type: "place_positions", ts: Date.now(), payload: boxes });
    });
  },
});
const { loop: orefLoop } = orefPoller;

mountAuthRoutes(app, {
  pool,
  hashPassword,
  normalizeEmail,
  getOrCreateUserWallet,
  buildWalletResponseRow,
});

mountWalletRoutes(app, {
  pool,
  requireUser,
  getOrCreateUserWallet,
  buildWalletResponseRow,
  insertLedger,
  broadcast,
});

mountBetsRoutes(app, {
  requireUser,
  betsService,
  broadcast,
});

const path = require("path");
const fs = require("fs");
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const { lookupFromGeoJson, MUNICIPALITIES_PATH } = require("./geojson-lookup");
const { resolvePlacesToGeoBoxes } = require("./place-resolver");

// Lookup uses cwd-relative path (same as mock: ./municipalities.geojson)
const GEOJSON_LOOKUP_PATH = path.join(process.cwd(), "municipalities.geojson");
// Streaming still uses server/data/ for backwards compatibility
const EMPTY_GEOJSON = JSON.stringify({ type: "FeatureCollection", features: [] });

function sendMunicipalitiesGeoJson(req, res) {
  res.set("Content-Type", "application/json");
  try {
    if (!fs.existsSync(MUNICIPALITIES_PATH)) {
      return res.status(200).send(EMPTY_GEOJSON);
    }
    const stat = fs.statSync(MUNICIPALITIES_PATH);
    if (!stat.isFile() || stat.size === 0) {
      return res.status(200).send(EMPTY_GEOJSON);
    }
    res.setHeader("Content-Length", stat.size);
    const stream = fs.createReadStream(MUNICIPALITIES_PATH, { encoding: "utf8" });
    stream.on("error", (err) => {
      if (!res.headersSent) res.status(500).json({ error: err?.message ?? "read error" });
      else res.end();
    });
    stream.pipe(res);
  } catch (e) {
    res.status(200).set("Content-Type", "application/json").send(EMPTY_GEOJSON);
  }
}

// Initial load: full polygon set for AlertTester and useOref (avoids cross-origin; always returns valid JSON)
app.get("/api/municipalities.geojson", sendMunicipalitiesGeoJson);
app.get("/api/geojson/all", sendMunicipalitiesGeoJson);

app.get("/api/geocode", async (req, res) => {
  const raw = req.query.place;
  const place = typeof raw === "string" ? raw.trim() : "";
  if (!place) {
    return res.status(400).json({ error: "place query required" });
  }
  // First: try server GeoJSON (cwd/municipalities.geojson, same as mock)
  const fromGeoJson = lookupFromGeoJson(place, GEOJSON_LOOKUP_PATH);
  if (fromGeoJson) {
    return res.json([fromGeoJson]);
  }
  // Fallback: Nominatim with place name only (no ", Israel" etc.)
  try {
    const url =
      `${NOMINATIM_URL}?q=${encodeURIComponent(place)}` +
      "&format=jsonv2&limit=5&addressdetails=1&accept-language=he,en&countrycodes=il,ps";
    const r = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "geo-alerts-server/1.0" },
    });
    if (!r.ok) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[geocode] Nominatim non-OK:", r.status, "place:", place.slice(0, 50));
      }
      return res.status(200).set("Content-Type", "application/json").json([]);
    }
    const data = await r.json();
    const arr = Array.isArray(data) ? data : [];
    if (process.env.NODE_ENV !== "test" && arr.length === 0) {
      console.warn("[geocode] Nominatim returned 0 results for:", place.slice(0, 50));
    }
    return res.json(arr);
  } catch (e) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[geocode] Nominatim error:", e?.message || e, "place:", place.slice(0, 50));
    }
    return res.status(200).set("Content-Type", "application/json").json([]);
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP API running on http://localhost:${HTTP_PORT}`);
});

async function expiryLoop() {
  while (true) {
    try {
      await expireMissedBets();
      await sleep(3000);
    } catch (e) {
      console.error("expiry loop error:", e?.message ?? e);
      await sleep(3000);
    }
  }
}

orefLoop();
expiryLoop();
