require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const express = require("express");
const { pool } = require("./db/pool");
const { createWsServer } = require("./ws/ws.server");
const { hashPassword, requireUser } = require("./auth/auth.service");
const { normalizeEmail } = require("./utils/normalize");
const {
  getOrCreateUserWallet,
  buildWalletResponseRow,
} = require("./wallet/wallet.service");
const { insertLedger } = require("./wallet/wallet.ledger");
const { sleep } = require("./utils/time");
const path = require("path");
const ingest = require(path.join(__dirname, "../dist/ingest/oref"));
const domainAlerts = require(path.join(__dirname, "../dist/domain/alerts"));
const inferenceApi = require(
  path.join(__dirname, "../dist/api/inference/inference.routes"),
);
const createInferenceService = require(
  path.join(__dirname, "../dist/api/inference/inference.service"),
).createInferenceService;
const { publishInference } = require(
  path.join(__dirname, "../dist/ws/publishInference"),
);
const { onInferenceReady } = require(
  path.join(__dirname, "../dist/events/onInferenceReady"),
);
const { enqueueScreenshot } = require(
  path.join(__dirname, "../dist/workers/screenshot/enqueueScreenshot"),
);
const { distanceKm: trajectoryDistanceKm } = require(
  path.join(__dirname, "../dist/geo/inference/math"),
);
const alertRepository = require(
  path.join(__dirname, "../dist/storage/repositories/alertRepository"),
);
const inferenceRepository = require(
  path.join(__dirname, "../dist/storage/repositories/inferenceRepository"),
);
const { createSettlementService } = require("./bets/settlement.service");
const { createExpiryService } = require("./bets/expiry.service");
const { createBetsService } = require("./bets/bets.service");
const { createOrefPoller } = require("./oref/oref.poller");
const { mountAuthRoutes } = require("./auth/auth.routes");
const { mountWalletRoutes } = require("./wallet/wallet.routes");
const { mountBetsRoutes } = require("./bets/bets.routes");

const PORT = Number(process.env.PORT || 5535);
const HTTP_PORT = Number(process.env.HTTP_PORT || 8090);

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:4421";

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", CORS_ORIGIN);
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

const GEOJSON_LOOKUP_PATH_FOR_INFERENCE = path.join(
  process.cwd(),
  "municipalities.geojson",
);
const IR_BASES_PATH = path.join(
  process.cwd(),
  "..",
  "client",
  "public",
  "data",
  "ir_bases.json",
);
const LEBANON_BOUNDARY_PATH = path.join(
  process.cwd(),
  "..",
  "client",
  "public",
  "data",
  "lb.json",
);
const IRAN_BOUNDARY_PATH = path.join(
  process.cwd(),
  "..",
  "client",
  "public",
  "data",
  "ir.json",
);
const inferenceService = createInferenceService({
  geojsonPath: GEOJSON_LOOKUP_PATH_FOR_INFERENCE,
  irBasesPath: IR_BASES_PATH,
  iranBoundaryPath: IRAN_BOUNDARY_PATH,
  lebanonBoundaryPath: LEBANON_BOUNDARY_PATH,
  getAlertByIdFromDb: (id) => alertRepository.getAlertById(pool, id),
  getInferenceByAlertIdFromDb: (alertId) =>
    inferenceRepository.getInferenceByAlertId(pool, alertId),
});

const SCREENSHOT_STORAGE_PATH = path.join(process.cwd(), "screenshots");
const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || "http://localhost:4421";
const SCREENSHOT_PUBLIC_URL = `http://localhost:${HTTP_PORT}/api/screenshots`;

const MIN_AREAS_FOR_SCREENSHOT = 40;
/** Min resolved settlements for screenshot; 10 aligns with trajectory (principal bearing needs 10+ positions). */
const MIN_MATCHED_SETTLEMENTS = 10;
/** Only take screenshots for this alert type (OREF title). */
const SCREENSHOT_ALERT_TITLE = "ירי רקטות וטילים";
/** Cooldown ms: only one screenshot per alert id within this window (avoids duplicates when OREF re-emits same alert). */
const SCREENSHOT_COOLDOWN_MS = 120_000;

const screenshotEnqueuedByAlertId = new Map();

function shouldTakeScreenshot(alert, result, renderData) {
  if ((alert.title || "").trim() !== SCREENSHOT_ALERT_TITLE) return false;
  if (renderData?.trajectoryTarget === "lebanon") return false;
  const areaCount = alert.settlements?.length ?? 0;
  const matchedCount = result?.cluster?.matchedSettlements?.length ?? 0;
  const confidence = result?.summary?.confidence;
  if (areaCount < MIN_AREAS_FOR_SCREENSHOT) return false;
  if (matchedCount < MIN_MATCHED_SETTLEMENTS) return false;
  if (confidence === "low") return false;
  return true;
}

function buildTelegramCaption(renderData, alert, result) {
  const origin = renderData?.trajectoryOriginPoint;
  const lat = origin?.lat;
  const lon = origin?.lon;
  const time = alert?.receivedAt ?? new Date().toISOString();
  const poly = renderData?.trajectoryPolyline;
  const distanceKm =
    Array.isArray(poly) && poly.length >= 2
      ? trajectoryDistanceKm(poly[0], poly[poly.length - 1])
      : result?.corridor?.maxDistanceKm;
  const url =
    lat != null && lon != null
      ? `https://www.google.com/maps?q=${lat},${lon}`
      : null;
  const lines = [];
  if (url) lines.push(`<a href="${url}">Location</a>`);
  lines.push(`Time: ${time}`);
  if (lat != null && lon != null) {
    lines.push(`Lat: ${lat}`);
    lines.push(`Long: ${lon}`);
  }
  if (distanceKm != null) lines.push(`Distance: ${Math.round(distanceKm)} km`);
  return lines.join("\n");
}

function enqueueScreenshotWithDeps(alertId, options) {
  const now = Date.now();
  for (const [id, ts] of screenshotEnqueuedByAlertId.entries()) {
    if (now - ts > SCREENSHOT_COOLDOWN_MS)
      screenshotEnqueuedByAlertId.delete(id);
  }
  if (screenshotEnqueuedByAlertId.has(alertId)) return;
  screenshotEnqueuedByAlertId.set(alertId, now);
  enqueueScreenshot(
    alertId,
    {
      broadcast,
      storagePath: SCREENSHOT_STORAGE_PATH,
      clientBaseUrl: CLIENT_BASE_URL,
      screenshotPublicUrl: SCREENSHOT_PUBLIC_URL,
      pool,
    },
    options,
  );
}

const { OREF_MOCK_SAMPLES } = require("./oref/mock-samples");

function mockFetchAlertsJson() {
  const sample =
    OREF_MOCK_SAMPLES[Math.floor(Math.random() * OREF_MOCK_SAMPLES.length)];
  return Promise.resolve({
    ...sample,
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    datetime: new Date().toISOString(),
  });
}

const orefPoller = createOrefPoller({
  broadcast,
  processAlertPayload,
  sleep,
  ...(process.env.USE_OREF_MOCK === "true" && {
    fetchAlertsJson: mockFetchAlertsJson,
    pollIntervalMs: 60000,
  }),
  onAlertReady(normalized, rawPayload) {
    const alert = domainAlerts.mapNormalizedToAlertEvent(
      normalized,
      rawPayload,
    );
    inferenceService.setActiveAlert(alert);
    alertRepository
      .persistAlert(pool, {
        id: alert.id,
        rawPayload,
        normalizedAlert: normalized,
        receivedAt: alert.receivedAt,
        settlementMatches: null,
      })
      .catch((e) => console.error("[persist] alert:", e?.message ?? e));
    publishInference(alert, inferenceService, broadcast)
      .then((result) => {
        if (result) {
          inferenceRepository
            .persistInference(pool, {
              alertId: alert.id,
              cluster: result.cluster,
              corridor: result.corridor,
              rankedCandidates: result.rankedCandidates,
              algorithmVersion: result.algorithmVersion,
              summary: result.summary,
            })
            .catch((e) =>
              console.error("[persist] inference:", e?.message ?? e),
            );
          alertRepository
            .updateAlertSettlementMatches(
              pool,
              alert.id,
              result.cluster.matchedSettlements,
            )
            .catch((e) =>
              console.error("[persist] update settlements:", e?.message ?? e),
            );
        }
        const renderData = result
          ? inferenceService.buildRenderData(result)
          : null;
        if (result && renderData && shouldTakeScreenshot(alert, result, renderData)) {
          const caption = buildTelegramCaption(renderData, alert, result);
          const origin = renderData?.trajectoryOriginPoint;
          onInferenceReady(
            alert.id,
            { enqueueScreenshot: enqueueScreenshotWithDeps },
            {
              caption,
              focusLat: origin?.lat,
              focusLon: origin?.lon,
            },
          );
        }
      })
      .catch((e) => {
        console.error("[inference] broadcast error:", e?.message ?? e);
      });
  },
  resolvePlacesAndBroadcast: (placeNames) => {
    if (!Array.isArray(placeNames) || placeNames.length === 0)
      return Promise.resolve();
    return resolvePlacesToGeoBoxes(placeNames, GEOJSON_LOOKUP_PATH).then(
      (boxes) => {
        broadcast({ type: "place_positions", ts: Date.now(), payload: boxes });
      },
    );
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

inferenceApi.mountInferenceRoutes(app, inferenceService);

// Serve screenshot PNGs (worker saves to SCREENSHOT_STORAGE_PATH)
app.get("/api/screenshots/:filename", (req, res) => {
  const filename = req.params.filename;
  if (!filename || !/^alert-[a-zA-Z0-9_-]+-\d+\.png$/.test(filename)) {
    return res.status(400).json({ error: "invalid filename" });
  }
  const filePath = path.join(SCREENSHOT_STORAGE_PATH, filename);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).json({ error: "not found" });
  }
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=3600");
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) res.status(500).end();
  });
  stream.pipe(res);
});

const fs = require("fs");
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const { lookupFromGeoJson, MUNICIPALITIES_PATH } = require("./geojson-lookup");
const { resolvePlacesToGeoBoxes } = require("./place-resolver");

// Lookup uses cwd-relative path (same as mock: ./municipalities.geojson)
const GEOJSON_LOOKUP_PATH = path.join(process.cwd(), "municipalities.geojson");
// Streaming still uses server/data/ for backwards compatibility
const EMPTY_GEOJSON = JSON.stringify({
  type: "FeatureCollection",
  features: [],
});

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
    const stream = fs.createReadStream(MUNICIPALITIES_PATH, {
      encoding: "utf8",
    });
    stream.on("error", (err) => {
      if (!res.headersSent)
        res.status(500).json({ error: err?.message ?? "read error" });
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
      headers: {
        Accept: "application/json",
        "User-Agent": "geo-alerts-server/1.0",
      },
    });
    if (!r.ok) {
      if (process.env.NODE_ENV !== "test") {
        console.warn(
          "[geocode] Nominatim non-OK:",
          r.status,
          "place:",
          place.slice(0, 50),
        );
      }
      return res.status(200).set("Content-Type", "application/json").json([]);
    }
    const data = await r.json();
    const arr = Array.isArray(data) ? data : [];
    if (process.env.NODE_ENV !== "test" && arr.length === 0) {
      console.warn(
        "[geocode] Nominatim returned 0 results for:",
        place.slice(0, 50),
      );
    }
    return res.json(arr);
  } catch (e) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[geocode] Nominatim error:",
        e?.message || e,
        "place:",
        place.slice(0, 50),
      );
    }
    return res.status(200).set("Content-Type", "application/json").json([]);
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP API running on http://localhost:${HTTP_PORT}`);
  if (process.env.USE_OREF_MOCK === "true") {
    console.log("[oref] Using mock OREF payload (USE_OREF_MOCK=true)");
  }
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
