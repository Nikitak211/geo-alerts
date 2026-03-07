/**
 * Mock server for live testing: same ports and message shape as real server.
 * - WS on PORT (8080): oref_update + hello (matches ws.server.js)
 * - HTTP on HTTP_PORT (8090): geocode + minimal API stubs (matches server.js)
 * Run: node mock-oref-ws.js  (or npm test)
 * Then point client at ws://localhost:8080 and http://localhost:8090.
 */

const http = require("http");
const url = require("url");
const path = require("path");
const { WebSocketServer } = require("ws");
const { lookupFromGeoJson } = require("./src/geojson-lookup");
const { resolvePlacesToGeoBoxes } = require("./src/place-resolver");

const PORT = Number(process.env.PORT || 8080);
const HTTP_PORT = Number(process.env.HTTP_PORT || 8090);
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const MOCK_GEOJSON_PATH = path.join("./", "municipalities.geojson");

/* ---------------- ALERT SAMPLES (match real Oref shape + alertDate/alertTime for settlement) ---------------- */

function nowIso() {
  return new Date().toISOString();
}

const samples = [
  {
    id: "134171226030000000",
    cat: "6",
    title: "חדירת כלי טיס עוין",
    data: [
      "עין קנייא",
      "שאר ישוב",
      "קריית שמונה",
      "מטולה",
      "מרגליות",
      "משגב עם",
      "כפר גלעדי",
      "תל חי",
      "שדה נחמיה",
      "כפר בלום",
      "להבות הבשן",
      "דן",
      "דפנה",
      "שניר",
      "מעיין ברוך",
      "הגושרים",
      "עמיר",
      "כפר סאלד",
      "גדות",
      "גונן",
      "קיבוץ יפתח",
      "מלכיה",
      "רמות נפתלי",
      "דישון",
      "יראון",
      "ברעם",
      "סאסא",
      "אביבים",
      "עלמה",
      "ריחניה",
      "קדיתא",
      "צפת",
      "ראש פינה",
      "חצור הגלילית",
      "טובא זנגריה",
      "יסוד המעלה",
      "אליפלט",
      "מחניים",
      "כחל",
      "אמנון",
      "ורד הגליל",
      "כורזים",
      "כפר הנשיא",
      "עמוקה",
      "מירון",
      "פקיעין",
      "כרמיאל",
      "מעלות תרשיחא",
      "שלומי",
      "נהריה",
    ],
    desc: "היכנסו מייד למרחב המוגן",
    alertDate: null,
    alertTime: null,
  },
  {
    id: "134171226030000001",
    cat: "1",
    title: "ירי רקטות וטילים",
    data: ["שדרות", "נתיבות", "אופקים"],
    desc: "היכנסו מייד למרחב המוגן",
    alertDate: null,
    alertTime: null,
  },
  {
    id: "134171226030000002",
    cat: "2",
    title: "חדירת מחבלים",
    data: ["כרמיאל", "מעלות-תרשיחא"],
    desc: "הישארו במרחב מוגן עד להודעה חדשה",
    alertDate: null,
    alertTime: null,
  },
];

function withAlertTimes(payload) {
  const t = nowIso();
  const d = t.slice(0, 10);
  return { ...payload, alertTime: t, alertDate: d };
}

let sampleIndex = 0;

/* ---------------- WS SERVER (port 8080) ---------------- */

const wsHttp = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Mock Oref WS; connect with WebSocket.");
});

const wss = new WebSocketServer({ server: wsHttp });

function broadcast(payload) {
  const withTime = withAlertTimes(payload);
  const msg = JSON.stringify({
    type: "oref_update",
    ts: Date.now(),
    payload: withTime,
  });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
  console.log("oref_update:", payload.title, payload.data?.length, "areas");
  if (Array.isArray(withTime.data) && withTime.data.length > 0) {
    resolvePlacesToGeoBoxes(withTime.data, MOCK_GEOJSON_PATH).then((boxes) => {
      const posMsg = JSON.stringify({
        type: "place_positions",
        ts: Date.now(),
        payload: boxes,
      });
      for (const client of wss.clients) {
        if (client.readyState === 1) client.send(posMsg);
      }
    });
  }
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "hello", ts: Date.now() }));
  broadcast(samples[sampleIndex % samples.length]);
  ws.on("message", (buf) => {
    const text = buf.toString();
    if (text === "next") {
      sampleIndex++;
      broadcast(samples[sampleIndex % samples.length]);
    }
  });
});

wsHttp.listen(PORT, () => {
  console.log(`Mock WS server: ws://localhost:${PORT}`);
});

/* ---------------- HTTP API SERVER (port 8090) ---------------- */

const apiServer = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-id");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  /* /api/health */
  if (pathname === "/api/health" && method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  /* /api/municipalities.geojson and /api/geojson/all - initial getAll polygons (never empty body) */
  const emptyGeoJson = () => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ type: "FeatureCollection", features: [] }));
  };
  if (
    (pathname === "/api/municipalities.geojson" ||
      pathname === "/api/geojson/all") &&
    method === "GET"
  ) {
    const fs = require("fs");
    const p = path.join(__dirname, "data", "municipalities.geojson");
    if (fs.existsSync(p)) {
      try {
        const stat = fs.statSync(p);
        if (!stat.isFile() || stat.size === 0) {
          emptyGeoJson();
        } else {
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Content-Length": stat.size,
          });
          fs.createReadStream(p, { encoding: "utf8" }).pipe(res);
        }
      } catch (_) {
        emptyGeoJson();
      }
    } else {
      emptyGeoJson();
    }
    return;
  }

  /* /api/geocode - first GeoJSON (server data folder), then Nominatim with place name only */
  if (pathname === "/api/geocode" && method === "GET") {
    const place = String(parsed.query.place ?? "").trim();
    console.log("___ place ___", place);
    if (!place) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "place required" }));
      return;
    }
    const fromGeoJson = lookupFromGeoJson(place, MOCK_GEOJSON_PATH);
    if (fromGeoJson) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([fromGeoJson]));
      return;
    }
    try {
      const u =
        `${NOMINATIM}?q=${encodeURIComponent(place)}` +
        "&format=jsonv2&limit=5&addressdetails=1&accept-language=he,en&countrycodes=il,ps";
      const r = await fetch(u, {
        headers: {
          Accept: "application/json",
          "User-Agent": "geo-alerts-mock/1.0",
        },
      });
      if (!r.ok) {
        console.warn(
          "[mock geocode] Nominatim non-OK:",
          r.status,
          "place:",
          place.slice(0, 50),
        );
      }
      const data = r.ok ? await r.json() : [];
      const arr = Array.isArray(data) ? data : [];
      if (arr.length === 0) {
        console.warn("[mock geocode] 0 results for:", place.slice(0, 50));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(arr));
    } catch (e) {
      console.warn(
        "[mock geocode] error:",
        e?.message || e,
        "place:",
        place.slice(0, 50),
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([]));
    }
    return;
  }

  /* /geocode (unchanged) */
  if (pathname === "/geocode" && method === "GET") {
    const place = String(parsed.query.place || "").trim();
    if (!place) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "place required" }));
      return;
    }
    try {
      const result = await geocode(place);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  /* Stub API routes (so client can load against mock only) */
  const stubJson = (obj) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  if (pathname === "/api/register" && method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { email } = JSON.parse(body || "{}");
        stubJson({
          ok: true,
          user: {
            id: "mock-user-id",
            email: email || "mock@test.local",
            wallet: {
              availableBalance: 100,
              reservedBalance: 0,
              totalBalance: 100,
            },
          },
        });
      } catch {
        stubJson({
          ok: true,
          user: {
            id: "mock-user-id",
            email: "mock@test.local",
            wallet: {
              availableBalance: 100,
              reservedBalance: 0,
              totalBalance: 100,
            },
          },
        });
      }
    });
    return;
  }

  if (pathname === "/api/login" && method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { email } = JSON.parse(body || "{}");
        stubJson({
          ok: true,
          user: {
            id: "mock-user-id",
            email: email || "mock@test.local",
            wallet: {
              availableBalance: 100,
              reservedBalance: 0,
              totalBalance: 100,
            },
          },
        });
      } catch {
        stubJson({
          ok: true,
          user: {
            id: "mock-user-id",
            email: "mock@test.local",
            wallet: {
              availableBalance: 100,
              reservedBalance: 0,
              totalBalance: 100,
            },
          },
        });
      }
    });
    return;
  }

  if (pathname === "/api/logout" && method === "POST") {
    stubJson({ ok: true });
    return;
  }

  if (pathname === "/api/me" && method === "GET") {
    if (!req.headers["x-user-id"]) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing x-user-id" }));
      return;
    }
    stubJson({
      id: req.headers["x-user-id"],
      email: "mock@test.local",
      wallet: { availableBalance: 100, reservedBalance: 0, totalBalance: 100 },
    });
    return;
  }

  if (pathname === "/api/payment-methods" && method === "GET") {
    if (!req.headers["x-user-id"]) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing x-user-id" }));
      return;
    }
    stubJson([{ id: "mock-pm-1", label: "Mock wallet", provider: "manual" }]);
    return;
  }

  if (pathname === "/api/bets/summary" && method === "GET") {
    if (!req.headers["x-user-id"]) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing x-user-id" }));
      return;
    }
    stubJson({
      open_count: 0,
      won_count: 0,
      lost_count: 0,
      void_count: 0,
    });
    return;
  }

  if (pathname === "/api/bets" && method === "GET") {
    if (!req.headers["x-user-id"]) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing x-user-id" }));
      return;
    }
    stubJson([]);
    return;
  }

  if (pathname === "/api/bets" && method === "POST") {
    if (!req.headers["x-user-id"]) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing x-user-id" }));
      return;
    }
    stubJson({ ok: true, betId: "mock-bet-" + Date.now() });
    return;
  }

  if (pathname === "/api/deposit" && method === "POST") {
    if (!req.headers["x-user-id"]) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing x-user-id" }));
      return;
    }
    stubJson({
      ok: true,
      user: {
        id: req.headers["x-user-id"],
        email: "mock@test.local",
        wallet: {
          availableBalance: 200,
          reservedBalance: 0,
          totalBalance: 200,
        },
      },
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

apiServer.listen(HTTP_PORT, () => {
  console.log(`Mock HTTP API: http://localhost:${HTTP_PORT}`);
  console.log(
    `  /api/health, /geocode?place=..., /api/register, /api/login, /api/me, /api/bets, ...`,
  );
});

/* ---------------- GEOCODE ---------------- */

const geoCache = new Map();
const GEO_TTL = 24 * 60 * 60 * 1000;
let queue = Promise.resolve();

async function geocode(place) {
  return (queue = queue.then(async () => {
    const cached = geoCache.get(place);
    if (cached && Date.now() - cached.ts < GEO_TTL) return cached.data;
    await new Promise((r) => setTimeout(r, 2100));
    const u =
      `${NOMINATIM}?q=${encodeURIComponent(`${place}, Israel`)}` +
      "&format=jsonv2&limit=1&countrycodes=il&addressdetails=0&accept-language=he";
    const r = await fetch(u, {
      headers: {
        Accept: "application/json",
        "User-Agent": "oref-alert-demo/1.0",
      },
    });
    if (!r.ok) throw new Error("Nominatim failed");
    const json = await r.json();
    const first = json?.[0] ?? null;
    geoCache.set(place, { ts: Date.now(), data: first });
    return first;
  }));
}

/* Cycle alerts every 7s */
setInterval(() => {
  sampleIndex++;
  broadcast(samples[sampleIndex % samples.length]);
}, 7000);
