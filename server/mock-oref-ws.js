const http = require("http");
const url = require("url");
const { WebSocketServer } = require("ws");

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/* ---------------- HTTP SERVER ---------------- */

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);

  if (parsed.pathname === "/geocode") {
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

  res.writeHead(404);
  res.end("not found");
});

/* ---------------- WS SERVER ---------------- */

const wss = new WebSocketServer({ server });

server.listen(8080, () => {
  console.log("MOCK server running");
  console.log("WS  -> ws://localhost:8080");
  console.log("HTTP-> http://localhost:8080/geocode?place=תל%20אביב");
});

/* ---------------- ALERT MOCK ---------------- */

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
    desc: "היכנסו מייד למרחב המוגן ",
  },
  {
    id: "134171226030000001",
    cat: "1",
    title: "ירי רקטות וטילים",
    data: ["שדרות", "נתיבות", "אופקים"],
    desc: "היכנסו מייד למרחב המוגן ",
  },
  {
    id: "134171226030000002",
    cat: "2",
    title: "חדירת מחבלים",
    data: ["כרמיאל", "מעלות-תרשיחא"],
    desc: "הישארו במרחב מוגן עד להודעה חדשה",
  },
];

let i = 0;

function broadcast(payload) {
  const msg = JSON.stringify({
    type: "oref_update",
    ts: Date.now(),
    payload,
  });

  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }

  console.log("sent:", payload.title, payload.data);
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "hello", ts: Date.now() }));

  broadcast(samples[i % samples.length]);

  ws.on("message", (buf) => {
    const text = buf.toString();

    if (text === "next") {
      i++;
      broadcast(samples[i % samples.length]);
    }
  });
});

setInterval(() => {
  i++;
  broadcast(samples[i % samples.length]);
}, 7000);

/* ---------------- GEOCODE ---------------- */

const geoCache = new Map();
const GEO_TTL = 24 * 60 * 60 * 1000;

let queue = Promise.resolve();

async function geocode(place) {
  return (queue = queue.then(async () => {
    const cached = geoCache.get(place);

    if (cached && Date.now() - cached.ts < GEO_TTL) {
      return cached.data;
    }

    await new Promise((r) => setTimeout(r, 2100)); // rate limit

    const url =
      `${NOMINATIM}?q=${encodeURIComponent(`${place}, Israel`)}` +
      "&format=jsonv2&limit=1&countrycodes=il&addressdetails=0&accept-language=he";

    const r = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "oref-alert-demo/1.0",
      },
    });

    if (!r.ok) throw new Error("Nominatim failed");

    const json = await r.json();

    const first = json?.[0] ?? null;

    geoCache.set(place, {
      ts: Date.now(),
      data: first,
    });

    return first;
  }));
}
