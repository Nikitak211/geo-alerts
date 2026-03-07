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
// Use path relative to this file so it works regardless of cwd (server/municipalities.geojson)
const MOCK_GEOJSON_PATH = path.join(__dirname, "municipalities.geojson");

/* ---------------- ALERT SAMPLES (match real Oref shape + alertDate/alertTime for settlement) ---------------- */

function nowIso() {
  return new Date().toISOString();
}

// Keep only large samples: 40 areas, 105 areas, and Cumta 07/03/2026 (נגב/יהודה/עוטף עזה).
const samples = [
  // 40-area: גוש דן + שומרון + השפלה
  {
    id: "134171226030000040",
    cat: "1",
    title: "ירי רקטות וטילים",
    data: [
      "תל אביב יפו",
      "אור יהודה",
      "בני ברק",
      "בת ים",
      "גבעת שמואל",
      "גבעתיים",
      "חולון",
      "יהוד מונוסון",
      "מקווה ישראל",
      "סביון",
      "פתח תקווה",
      "קריית אונו",
      "ראשון לציון",
      "רחובות",
      "רמת גן",
      "קרני שומרון",
      "לוד",
      "אריאל",
      "כפר קאסם",
      "ראש העין",
      "שוהם",
      "הוד השרון",
      "רמלה",
      "באר יעקב",
      "נס ציונה",
      "אלעד",
      "יבנה",
      "מודיעין-מכבים-רעות",
      "דרום השרון",
      "ברנר",
      "חבל מודיעין",
      "מטה בנימין",
      "גזר",
      "שדות דן",
      "שומרון",
      "גן רווה",
      "חבל יבנה",
      "גדרות",
      "עמק המעיינות",
      "ערבות הירדן",
    ],
    desc: "היכנסו מייד למרחב המוגן",
    alertDate: null,
    alertTime: null,
  },
  // 105-area: מעלה אדומים, ירושלים, שפלת יהודה, שומרון, יהודה, בקעה
  {
    id: "134171226030000105",
    cat: "1",
    title: "ירי רקטות וטילים",
    data: [
      "מעלה אדומים",
      "ירושלים",
      "מבשרת ציון",
      "בית שמש",
      "ביתר עילית",
      "מודיעין-מכבים-רעות",
      "גדרה",
      "קריית גת",
      "קריית מלאכי",
      "גן יבנה",
      "מטה בנימין",
      "מגילות",
      "מטה יהודה",
      "ערבות הירדן",
      "גוש עציון",
      "עמק המעיינות",
      "נחל שורק",
      "גזר",
      "שפיר",
      "יואב",
      "מ\"א באר טוביה",
      "גדרות",
      "לכיש",
      "ברנר",
      "חוף אשקלון",
      "חבל יבנה",
      "בית חורון",
      "מעלה מכמש",
      "רימונים",
      "כוכב השחר",
      "מגרון",
      "גבע בנימין",
      "תל ציון",
      "כוכב יעקב",
      "פסגות",
      "גבעת אסף",
      "אלון",
      "נופי פרת",
      "מצפה יריחו",
      "הר גילה",
      "עלמון",
      "כפר אדומים",
      "קידר",
      "קליה",
      "בית הערבה",
      "אלמוג",
      "ורד יריחו",
      "חוף קליה",
      "עין ראפה",
      "מעלה החמישה",
      "נווה אילן",
      "יד השמונה",
      "עין נקובא",
      "גבעת יערים",
      "קריית ענבים",
      "מבוא ביתר",
      "רמת רזיאל",
      "בית נקופה",
      "שורש",
      "נטף",
      "שואבה",
      "אבו גוש",
      "הר אדר",
      "צובה",
      "קריית יערים",
      "כסלון",
      "גבעת זאב",
      "מוצא עילית",
      "אורה",
      "אבן ספיר",
      "עמינדב",
      "בית זית",
      "גבעון החדשה",
      "ייט\"ב",
      "נעמה",
      "מבואות יריחו",
      "נערן",
      "מחסיה",
      "צרעה",
      "הראל",
      "אשתאול",
      "נס הרים",
      "לטרון",
      "זנוח",
      "תרום",
      "כפר אוריה",
      "תעוז",
      "ישעי",
      "מסילת ציון",
      "בית מאיר",
      "מטע",
      "צור הדסה",
      "בר גיורא",
      "נחם",
      "בית אל",
      "נווה דניאל",
      "גבעות",
      "מבוא חורון",
      "אביעזר",
      "אפרת",
      "ראש צורים",
      "אלעזר",
      "גיזו",
      "נתיב הל\"ה",
      "קדר",
    ],
    desc: "היכנסו מייד למרחב המוגן",
    alertDate: null,
    alertTime: null,
  },
  // Cumta 07/03/2026: מערב הנגב, עוטף עזה, מרכז הנגב, יהודה, לכיש, שפלת יהודה, דרום הנגב — יישובים מרכזיים + מועצות
  {
    id: "134171226030000206",
    cat: "1",
    title: "ירי רקטות וטילים",
    data: [
      "מעלה אדומים",
      "ירושלים",
      "אופקים",
      "באר שבע",
      "ערד",
      "נתיבות",
      "מגילות",
      "מטה בנימין",
      "גוש עציון",
      "הר חברון",
      "אל קסום",
      "בני שמעון",
      "תמר",
      "מרחבים",
      "אשכול",
      "לכיש",
      "שדות נגב",
      "שער הנגב",
      "מטה יהודה",
      "עמק המעיינות",
      "חוות נחלת אבות",
      "סוסיא הקדומה",
      "בני אדם",
      "חוות בניהו",
      "חוות ינון",
      "מצפה חגית",
      "ברוש",
      "שדה צבי",
      "מבועים",
      "אורים",
      "זרועה",
      "יושיביה",
      "דורות",
      "גילת",
      "שיבולים",
      "שבי דרום",
      "בית הגדי",
      "קלחים",
      "פטיש",
      "רנן",
      "ניר עקיבא",
      "ניר משה",
      "שרשרת",
      "רוחמה",
      "בטחה",
      "מעגלים",
      "גבעולים",
      "מלילות",
      "עין השלושה",
      "נירים",
      "שובה",
      "תקומה",
      "מגן",
      "יכיני",
      "סעד",
      "גבים",
      "בארי",
      "מפלסים",
      "כפר עזה",
      "רעים",
      "כפר מימון ותושיה",
      "עלומים",
      "משמר הנגב",
      "שובל",
      "רהט",
      "בית קמה",
      "דביר",
      "בני דקלים",
      "כרמי קטיף",
      "נטע",
      "שקף",
      "אליאב",
      "שומריה",
      "אחוזם",
      "חוות אשכולות",
      "אפקה",
      "ראש צורים",
      "מיצד",
      "פני קדם",
      "כפר עציון",
      "כרמי צור",
      "בת עין",
      "אלון שבות",
      "תלם",
      "מגדל עוז",
      "נווה דניאל",
      "צומת הגוש",
      "גבעות עדן",
      "נחושה",
      "בית הברכה",
      "חוות ארץ האיילים",
      "בקעת בית שאן",
      "חוות קשואלה",
      "חוות תלם צפון",
      "עוז וגאון",
      "שדה בועז",
      "הגבעה הצהובה",
      "חוות מקנה יהודה",
      "חירן",
      "כרמי קטיף ואמציה",
    ],
    desc: "היכנסו מייד למרחב המוגן",
    alertDate: null,
    alertTime: null,
  },
  // Cumta 07/03/2026 00:29: באר שבע, אופקים, ערד, דימונה, בני שמעון, נווה מדבר, אשכול, מרחבים, רמת הנגב, אל קסום, הר חברון, תמר
  {
    id: "134171226030000207",
    cat: "1",
    title: "ירי רקטות וטילים",
    data: [
      "באר שבע",
      "אופקים",
      "ערד",
      "דימונה",
      "בני שמעון",
      "נווה מדבר",
      "אשכול",
      "מרחבים",
      "רמת הנגב",
      "אל קסום",
      "הר חברון",
      "תמר",
      "אל סייד",
      "שגב שלום",
      "חורה",
      "נבטים",
      "תל שבע",
      "אום בטין",
      "באר שבע - צפון",
      "באר שבע - מערב",
      "לקיה",
      "באר שבע - מזרח",
      "חצרים",
      "באר שבע - דרום",
      "עומר",
      "אבו תלול",
      "כסייפה",
      "אבו קרינאת",
      "ערערה בנגב",
      "סעווה",
      "ואדי אל נעם דרום",
      "צאלים",
      "אתר דודאים",
      "אופקים",
      "קריית חינוך מרחבים",
      "גבולות",
      "תפרח",
      "אשל הנשיא",
      "רתמים",
      "מרעית",
      "קסר א-סר",
      "כרמית",
      "מיתר",
      "כרמים",
      "תל ערד",
      "אל פורעה",
      "להב",
      "אזור תעשייה עידן הנגב",
      "אשכולות",
      "להבים",
      "משמר הנגב",
      "רהט",
      "תארבין",
      "גבעות בר",
      "סנסנה",
      "גילת",
      "שני ליבנה",
      "עשהאל",
      "הר עמשא",
      "טנא עומרים",
      "שמעה",
      "בית יתיר",
      "מסלול",
      "פדויים",
      "רנן",
      "בטחה",
      "פטיש",
      "ברוש",
      "תדהר",
      "שובל",
      "דביר",
      "תאשור",
      "חוות טואמין",
      "חוות טליה",
      "דימונה",
      "כפר הנוקדים",
      "חירן",
      "אזור תעשייה דימונה",
      "עין בוקק",
      "אשתמוע",
      "חוות מור ואברהם",
      "חוות מקנה יהודה",
      "חוות אשכולות",
      "סוסיא",
      "מצדה",
      "אביגיל",
      "חוות דרומא",
      "חוות יויו",
      "חוות מנחם",
      "מצפה יאיר",
      "סוסיא הקדומה",
      "מלונות ים המלח מרכז",
      "בתי מלון ים המלח",
      "נווה זוהר",
      "שומריה",
    ],
    desc: "היכנסו מייד למרחב המוגן",
    alertDate: null,
    alertTime: null,
  },
  // Cumta 05/03/2026 20:32: צפון — שלומי, קריית שמונה, עכו, חיפה, גולן
  {
    id: "134171226030000208",
    cat: "1",
    title: "ירי רקטות וטילים",
    data: [
      "שלומי",
      "קריית שמונה",
      "תל חי",
      "מטולה",
      "עכו",
      "קריית ביאליק",
      "קריית מוצקין",
      "קריית אתא",
      "שפרעם",
      "חיפה",
      "דלית אל כרמל",
      "טירת כרמל",
      "נשר",
      "קריית ים",
      "עתלית",
      "עספיא",
      "מג'דל שמס",
      "מעלה יוסף",
      "הגליל העליון",
      "מטה אשר",
      "מבואות החרמון",
      "מרום הגליל",
      "חוף הכרמל",
      "זבולון",
      "עמק יזרעאל",
      "משגב",
      "אל בטוף",
      "גולן",
      "ניר עציון",
      "ימין אורד",
      "עוזייר",
      "רומאנה",
      "כפר ח'וואלד",
      "ג'דידה מכר",
      "כפר מסריק",
      "עין המפרץ",
      "עכו - אזור תעשייה",
      "בית העלמין החדש עכו",
      "עכו - רמות ים",
      "ריינה",
      "רמת ישי",
      "רכסים",
      "אלוני הבשן",
      "מג'דל שמס",
      "שעל",
      "מסעדה",
      "אורטל",
      "נמרוד",
      "אודם",
      "אל רום",
      "מרום גולן",
      "עין זיוון",
      "נווה אטי\"ב",
      "בוקעתא",
    ],
    desc: "היכנסו מייד למרחב המוגן",
    alertDate: null,
    alertTime: null,
  },
];

function withAlertTimes(payload) {
  const t = nowIso();
  const d = t.slice(0, 10);
  return { ...payload, alertTime: t, alertDate: d };
}

// Start with trajectory sample (Judea/Samaria → Ashdod) for easy testing; cycle includes all samples.
let sampleIndex = 0;

/* ---------------- WS SERVER (port 8080) ---------------- */

const wsHttp = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Mock Oref WS; connect with WebSocket.");
});

const wss = new WebSocketServer({ server: wsHttp });

async function broadcast(payload) {
  const withTime = withAlertTimes(payload);
  const placeNames = Array.isArray(withTime.data) ? withTime.data : [];
  // Resolve positions first and send place_positions before oref_update so the client
  // has positions when it processes the alert (required for trajectory polyline).
  if (placeNames.length > 0) {
    try {
      const boxes = await resolvePlacesToGeoBoxes(placeNames, MOCK_GEOJSON_PATH);
      const posMsg = JSON.stringify({
        type: "place_positions",
        ts: Date.now(),
        payload: boxes,
      });
      for (const client of wss.clients) {
        if (client.readyState === 1) client.send(posMsg);
      }
    } catch (e) {
      console.warn("mock resolvePlacesToGeoBoxes failed:", e.message);
    }
  }
  const msg = JSON.stringify({
    type: "oref_update",
    ts: Date.now(),
    payload: withTime,
  });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
  console.log("oref_update:", payload.title, placeNames.length, "areas");
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
