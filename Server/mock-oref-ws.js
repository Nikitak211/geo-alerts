/**
 * Mock server for live testing: same ports and message shape as real server.
 * - WS on PORT (5535): oref_update + hello (matches ws.server.js)
 * - HTTP on HTTP_PORT (8090): geocode + minimal API stubs + /api/alerts/:id/render-data for screenshots
 * - When alerts broadcast: runs inference, caches render-data, triggers screenshot worker (PNG to ./screenshots).
 * Run: npm run build && node mock-oref-ws.js  (or npm test)
 * Then point client at ws://localhost:5535 and http://localhost:8090.
 * Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID in server/.env to post screenshots to Telegram.
 */

require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const { lookupFromGeoJson } = require("./src/geojson-lookup");
const { resolvePlacesToGeoBoxes } = require("./src/place-resolver");

const PORT = Number(process.env.PORT || 5535);
const HTTP_PORT = Number(process.env.HTTP_PORT || 8090);
const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || "http://localhost:4421";
const SCREENSHOT_STORAGE = path.join(__dirname, "screenshots");

/* Load inference pipeline for render-data + screenshot (requires prior npm run build) */
let ingestOref;
let domainAlerts;
let createInferenceService;
let renderMapScreenshot;
try {
  ingestOref = require("./dist/ingest/oref");
  domainAlerts = require("./dist/domain/alerts");
  createInferenceService = require("./dist/api/inference/inference.service").createInferenceService;
  renderMapScreenshot = require("./dist/workers/screenshot/renderMapScreenshot").renderMapScreenshot;
} catch (e) {
  console.warn("Inference/screenshot not loaded (run npm run build):", e.message);
}
let trajectoryDistanceKm;
try {
  trajectoryDistanceKm = require("./dist/geo/inference/math").distanceKm;
} catch (_) {}
const mockGeojsonPath = path.join(__dirname, "municipalities.geojson");
const irBasesPath = path.join(__dirname, "..", "client", "public", "data", "ir_bases.json");
const iranBoundaryPath = path.join(__dirname, "..", "client", "public", "data", "ir.json");
const lebanonBoundaryPath = path.join(__dirname, "..", "client", "public", "data", "lb.json");
const inferenceService = createInferenceService
  ? createInferenceService({
      geojsonPath: mockGeojsonPath,
      iranCandidatesPath: path.join(__dirname, "src", "data", "iran", "iran_candidate_regions.geojson"),
      irBasesPath,
      iranBoundaryPath,
      lebanonBoundaryPath,
    })
  : null;
const renderDataCache = new Map();

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
  // // 105-area: מעלה אדומים, ירושלים, שפלת יהודה, שומרון, יהודה, בקעה
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
      'מ"א באר טוביה',
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
      'ייט"ב',
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
      'נתיב הל"ה',
      "קדר",
    ],
    desc: "היכנסו מייד למרחב המוגן",
    alertDate: null,
    alertTime: null,
  },
  // // Cumta 07/03/2026: מערב הנגב, עוטף עזה, מרכז הנגב, יהודה, לכיש, שפלת יהודה, דרום הנגב — יישובים מרכזיים + מועצות
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
  // // Cumta 07/03/2026 00:29: באר שבע, אופקים, ערד, דימונה, בני שמעון, נווה מדבר, אשכול, מרחבים, רמת הנגב, אל קסום, הר חברון, תמר
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
  // // Cumta 05/03/2026 20:32: צפון — שלומי, קריית שמונה, עכו, חיפה, גולן
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
      'נווה אטי"ב',
      "בוקעתא",
    ],
    desc: "היכנסו מייד למרחב המוגן",
    alertDate: null,
    alertTime: null,
  },
  // Northern Israel: Haifa, Acre, Karmiel, Tiberias, Nazareth — Mahabad trajectory
  {
    id: "134171226030000209",
    cat: "1",
    title: "ירי רקטות וטילים",
    data: [
      "ג'דידה מכר",
      "אזור תעשייה ניר עציון",
      "ניר עציון",
      "ימין אורד",
      "עין הוד",
      "עין חוד",
      "דלית אל כרמל",
      "בית צבי",
      "מגדים",
      "אזור תעשייה יקנעם עילית",
      "אזור תעשייה מבוא כרמל",
      "אליקים",
      "יקנעם המושבה והזורע",
      "יקנעם עילית",
      "עין העמק",
      "אושה",
      "אזור תעשייה שער נעמן",
      "אפק",
      "חיפה - בת גלים ק.אליעזר",
      "חיפה - כרמל",
      "הדר ועיר תחתית",
      "חיפה - מערב",
      "חיפה - מפרץ",
      "חיפה - נווה שאנן ורמות כרמל",
      "חיפה - קריית חיים ושמואל",
      "כפר ביאליק",
      "כפר המכבי",
      "קריית אתא",
      "קריית ביאליק",
      "קריית ים",
      "קריית מוצקין",
      "רמת יוחנן",
      "אזור תעשייה קריית ביאליק",
      "נשר",
      "אורנים",
      "אזור תעשייה בר-לב",
      "אזור תעשייה כרמיאל",
      "אחיהוד",
      "איבטין",
      "אלון הגליל",
      "אלוני אבא",
      "אלונים",
      "אעבלין",
      "ביר אלמכסור",
      "בית אורן",
      "בית לחם הגלילית",
      "בית שערים",
      "בסמת טבעון",
      "בענה",
      "גבעת אלה",
      "גבעת וולפסון",
      "גבת",
      "דמיידה",
      "הושעיה",
      "הסוללים",
      "הרדוף",
      "זרזיר",
      "חג'אג'רה",
      "חנתון",
      "טבריה",
      "טירת כרמל",
      "טמרה",
      "יגור",
      "יובלים",
      "יודפת",
      "יסעור",
      "יעד",
      "יפיע",
      "יפעת",
      "כאבול",
      "כאוכב אבו אלהיג'א",
      "כעביה טבאש",
      "כפר גלים",
      "כפר החורש",
      "כפר חסידים",
      "כפר כנא",
      "כפר מנדא",
      "כפר מסריק",
      "כפר נהר הירדן",
      "כפר תקווה",
      "כרמיאל",
      "מג'דל כרום",
      "מגדל העמק",
      "מורשת",
      "מנוף",
      "מנשית זבדה",
      "מצפה אבי''ב",
      "מצפה",
      "מרכז אזורי משגב",
      "משהד",
      "נהלל",
      "נוף הגליל",
      "נופית",
      "נצרת",
      "עדי",
      "עילוט",
      "עין המפרץ",
      "עין מאהל",
      "עכו - אזור תעשייה",
      "עספיא",
      "עצמון - שגב",
      "ערב אל נעים",
      "צורית גילון",
      "ציפורי",
      "קורנית",
      "קריית טבעון - בית זייד",
      "ראס עלי",
      "ריינה",
      "רכסים",
      "רמת דוד",
      "רמת ישי",
      "רקפת",
      "שדה יעקב",
      "שורשים",
      "שכניה",
      "שמשית",
      "שעב",
      "שער העמקים",
      "שפרעם",
      "תמרת",
      "אבטליון",
      "אזור תעשייה קדמת גליל",
      "אזור תעשייה תרדיון",
      "אילניה",
      "ארבל",
      "אשבל",
      "אשחר",
      "אתר ההנצחה גולני",
      "בועיינה-נוג'ידאת",
      "בית העלמין החדש עכו",
      "בית סוהר צלמון",
      "בית סוהר קישון",
      "בית קשת",
      "בית רימון",
      "גבעת אבני",
      "גינוסר",
      "דיר חנא",
      "הודיות",
      "הזורעים",
      "הררית יחד",
      "ואדי אל חמאם",
      "חוסנייה",
      "חוקוק",
      "חזון",
      "טורעאן",
      "טל - אל",
      "טפחות",
      "כדורי",
      "כלנית",
      "כמון - כמאנה מזרחית",
      "כפר זיתים",
      "כפר חיטים",
      "כפר כמא",
      "לביא",
      "לבנים",
      "לוטם וחמדון",
      "מגדל",
      "מכמנים - כמאנה מערבית",
      "מסד",
      "מע'אר",
      "מעלה צביה",
      "מצפה נטופה",
      "נבי שועייב",
      "סכנין",
      "סלמה",
      "עוזייר",
      "רומאנה",
      "עילבון",
      "עראבה",
      "פלך",
      "ראס אל-עין",
      "רביד",
      "רומת אל הייב",
      "שדה אילן",
      "שרונה",
      "תובל",
      "אזור תעשייה ציפורית",
      "בית עלמין תל רגב",
      "כפר ח'וואלד",
      "סואעד חמירה",
      "תחנת רכבת כפר יהושוע",
      "החותרים",
      "כפר יהושע",
    ],
    desc: "היכנסו למרחב המוגן",
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

/* ---------------- WS SERVER (port 5535) ---------------- */

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
      const boxes = await resolvePlacesToGeoBoxes(
        placeNames,
        MOCK_GEOJSON_PATH,
      );
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

  /* Run inference, cache render-data, and trigger screenshot (PNG) so render page can load and worker can capture */
  if (inferenceService && ingestOref && domainAlerts && renderMapScreenshot) {
    setImmediate(() => {
      runInferenceAndScreenshot(withTime).catch((e) => {
        console.error("[mock] inference/screenshot:", e?.message ?? e);
      });
    });
  }
}

const MIN_AREAS_FOR_SCREENSHOT = 40;
const MIN_MATCHED_SETTLEMENTS = 10;
const SCREENSHOT_ALERT_TITLE = "ירי רקטות וטילים";
/** Cooldown ms: only one screenshot per alert id within this window (avoids 2–4x when multiple clients connect or interval fires). */
const SCREENSHOT_COOLDOWN_MS = 120_000;

const screenshotSentByAlertId = new Map();

function shouldTakeScreenshot(alert, result) {
  if ((alert.title || "").trim() !== SCREENSHOT_ALERT_TITLE) return false;
  const areaCount = alert.settlements?.length ?? 0;
  const matchedCount = result?.cluster?.matchedSettlements?.length ?? 0;
  const confidence = result?.summary?.confidence;
  if (areaCount < MIN_AREAS_FOR_SCREENSHOT) return false;
  if (matchedCount < MIN_MATCHED_SETTLEMENTS) return false;
  if (confidence === "low") return false;
  return true;
}

async function runInferenceAndScreenshot(payload) {
  const normalized = ingestOref.orefToNormalizedAlert(payload);
  if (!normalized) return;
  const alert = domainAlerts.mapNormalizedToAlertEvent(normalized, payload);
  const now = Date.now();
  for (const [id, ts] of screenshotSentByAlertId.entries()) {
    if (now - ts > SCREENSHOT_COOLDOWN_MS) screenshotSentByAlertId.delete(id);
  }
  if (screenshotSentByAlertId.has(alert.id)) return;
  inferenceService.setActiveAlert(alert);
  const result = await inferenceService.runInferenceForAlert(alert);
  if (!result) return;
  let renderData = inferenceService.buildRenderData(result);
  renderData = {
    ...renderData,
    receivedAt: alert.receivedAt,
    impactAreaNames: result.cluster.matchedSettlements.map((s) => s.name),
  };
  renderDataCache.set(alert.id, renderData);

  /* Broadcast inference_result so main map uses same trajectory as screenshot (both correct). */
  try {
    const { INFERENCE_RESULT } = require("./dist/ws/alertSocket");
    const { loadIranCandidates } = require("./dist/geo/candidates");
    const candidates = loadIranCandidates({
      dataPath: path.join(__dirname, "src", "data", "iran", "iran_candidate_regions.geojson"),
    });
    const idToName = new Map(candidates.map((c) => [c.id, c.name]));
    const topCandidates = (result.rankedCandidates || []).map((r, index) => ({
      candidateId: r.candidateId,
      name: idToName.get(r.candidateId) ?? r.candidateId,
      rank: index + 1,
      score: r.score,
      confidence: r.confidence,
    }));
    const inferencePayload = {
      type: INFERENCE_RESULT,
      ts: Date.now(),
      payload: {
        alertSummary: {
          id: alert.id,
          title: alert.title,
          receivedAt: alert.receivedAt,
          category: alert.category,
          settlementCount: alert.settlements?.length ?? 0,
        },
        cluster: result.cluster,
        corridor: result.corridor,
        topCandidates,
        confidence: result.summary.confidence,
        algorithmVersion: result.algorithmVersion,
        trajectoryPolyline: renderData?.trajectoryPolyline,
        trajectoryTarget: renderData?.trajectoryTarget,
      },
    };
    const msg = JSON.stringify(inferencePayload);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(msg);
    }
  } catch (e) {
    console.warn("[mock] inference_result broadcast failed:", e?.message ?? e);
  }

  if (!shouldTakeScreenshot(alert, result)) return;
  screenshotSentByAlertId.set(alert.id, now);
  const origin = renderData?.trajectoryOriginPoint;
  let screenshotMeta;
  try {
    screenshotMeta = await renderMapScreenshot(alert.id, {
      baseUrl: CLIENT_BASE_URL,
      storagePath: SCREENSHOT_STORAGE,
      focusLat: origin?.lat,
      focusLon: origin?.lon,
    });
  } catch (e) {
    if (e?.name === "ScreenshotSkippedSafetyError") {
      console.warn("[mock] screenshot skipped for safety (dev/build errors visible)");
      return;
    }
    throw e;
  }
  console.log("[mock] screenshot saved for alert", alert.id);

  function buildTelegramCaption(renderData, alert, result) {
    const origin = renderData?.trajectoryOriginPoint;
    const lat = origin?.lat;
    const lon = origin?.lon;
    const time = alert?.receivedAt ?? new Date().toISOString();
    const poly = renderData?.trajectoryPolyline;
    const distanceKm =
      trajectoryDistanceKm && Array.isArray(poly) && poly.length >= 2
        ? trajectoryDistanceKm(poly[0], poly[poly.length - 1])
        : result?.corridor?.maxDistanceKm;
    const url =
      lat != null && lon != null
        ? `https://www.google.com/maps?q=${lat},${lon}`
        : null;
    const lines = [];
    if (url) lines.push(`<a href="${url}">Link</a>`);
    lines.push(`Time: ${time}`);
    if (lat != null && lon != null) lines.push(`Lat, Long: ${lat}, ${lon}`);
    if (distanceKm != null) lines.push(`Distance: ${Math.round(distanceKm)} km`);
    return lines.join("\n");
  }

  try {
    const { sendPhotoToTelegram } = require("./dist/workers/telegram/sendToTelegram");
    const caption = buildTelegramCaption(renderData, alert, result);
    const sent = await sendPhotoToTelegram({ filePath: screenshotMeta.path, caption });
    if (sent) console.log("[mock] screenshot posted to Telegram channel");
  } catch (e) {
    console.error("[mock] Telegram post failed:", e?.message ?? e);
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
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:4421");
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

  const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost:8090"}`);
  const pathname = reqUrl.pathname;
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
    const place = String(reqUrl.searchParams.get("place") ?? "").trim();
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
    const place = String(reqUrl.searchParams.get("place") || "").trim();
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

  /* /api/alerts/:id/render-data — for screenshot worker (render page fetches this) */
  const renderDataMatch = pathname && pathname.match(/^\/api\/alerts\/([^/]+)\/render-data$/);
  if (renderDataMatch && method === "GET") {
    const alertId = decodeURIComponent(renderDataMatch[1]);
    const cached = renderDataCache.get(alertId);
    if (!cached) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Alert or render-data not found" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(cached));
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
  if (inferenceService && renderMapScreenshot) {
    console.log(`  /api/alerts/:id/render-data (for screenshots)`);
    console.log(`  Screenshots: ensure client is running at ${CLIENT_BASE_URL}; PNGs saved to ${SCREENSHOT_STORAGE}`);
  }
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
