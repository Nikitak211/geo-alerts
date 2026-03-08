/**
 * Strike news from Telegram via client session (GramJS/MTProto).
 * For public OSINT channels you do NOT control – no bot admin needed.
 * Uses api_id + api_hash from my.telegram.org; one-time phone login saves session.
 * Set TELEGRAM_API_ID, TELEGRAM_API_HASH. Run: node scripts/telegram-login.js (once)
 */

const path = require("path");
const { excludeIsrael, extractPlaceName, geocodePlace } = require("./strikeNews.shared");

const POLL_INTERVAL_MS = 90 * 1000; // 1.5 min

const STRIKE_KEYWORDS = [
  "iran", "strike", "missile", "drone", "explosion", "attack", "tehran", "baghdad",
  "damascus", "houthi", "saudi", "uae", "yemen", "iraq", "syria", "gulf", "beirut",
];

const DEFAULT_CHANNELS = ["warmonitors", "intelslava"];

function isRelevant(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return STRIKE_KEYWORDS.some((k) => lower.includes(k));
}

function createTelegramPoller(deps) {
  const { setStrikeNews, sleep } = deps;
  const log = (...args) => console.log("[strikeNews:telegram]", ...args);

  const apiId = process.env.TELEGRAM_API_ID ? parseInt(process.env.TELEGRAM_API_ID, 10) : null;
  const apiHash = process.env.TELEGRAM_API_HASH || null;
  // StoreSession expects a relative folder name – it joins with cwd internally
  const sessionPath = process.env.TELEGRAM_SESSION_PATH || "telegram_session";
  const channelList = (process.env.TELEGRAM_CHANNELS || DEFAULT_CHANNELS.join(","))
    .split(",")
    .map((c) => c.trim().replace(/^@/, ""))
    .filter(Boolean);

  const seenIds = new Set();
  const MAX_SEEN = 500;

  let client = null;
  let clientReady = false;

  async function getClient() {
    if (clientReady && client) return client;
    if (!apiId || !apiHash) return null;
    try {
      const { TelegramClient } = require("telegram");
      const { StoreSession } = require("telegram/sessions");
      const session = new StoreSession(sessionPath);
      client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
        useWSS: false,
      });
      await client.connect();
      if (!(await client.isUserAuthorized())) {
        log("Not authorized. Run: node scripts/telegram-login.js");
        client = null;
        return null;
      }
      clientReady = true;
      return client;
    } catch (e) {
      log("client init error:", e?.message || e);
      client = null;
      return null;
    }
  }

  async function pollOnce() {
    const c = await getClient();
    if (!c) return;
    try {
      const all = [];
      for (const channelName of channelList) {
        try {
          const peer = await c.getEntity(channelName);
          const messages = await c.getMessages(channelName, { limit: 20 });
          const channelTitle = peer?.title || channelName;
          const username = peer?.username || channelName;
          const list = Array.isArray(messages) ? messages : messages ? [...messages] : [];
          for (const msg of list) {
            if (!msg?.text) continue;
            const text = msg.text;
            if (!isRelevant(text)) continue;
            const id = `tg-${channelName}-${msg.id}`;
            if (seenIds.has(id)) continue;
            seenIds.add(id);
            if (seenIds.size > MAX_SEEN) {
              const arr = [...seenIds];
              seenIds.clear();
              arr.slice(-MAX_SEEN / 2).forEach((x) => seenIds.add(x));
            }
            const title = text.slice(0, 200).replace(/\n/g, " ");
            if (excludeIsrael({ title, description: text })) continue;
            const placeName =
              extractPlaceName(title, text) ||
              title.split(/[,\n]/)[0]?.trim()?.slice(0, 50) ||
              null;
            const link = username
              ? `https://t.me/${username}/${msg.id}`
              : `https://t.me/c/${String(peer?.id || "").replace(/^-100/, "")}/${msg.id}`;
            all.push({
              id,
              title,
              description: text.slice(0, 500),
              url: link,
              publishedAt: msg.date ? new Date(msg.date * 1000).toISOString() : "",
              sourceName: channelTitle,
              placeName,
            });
          }
          await sleep(300);
        } catch (e) {
          log("channel error", channelName, e?.message);
        }
      }

      if (all.length === 0) return;

      const items = [];
      for (const p of all) {
        const place = p.placeName || (p.title || "").split(/[,-]/)[0]?.trim();
        if (!place) continue;
        const coords = await geocodePlace(place);
        if (coords) items.push({ ...p, lat: coords.lat, lon: coords.lon });
        await sleep(200);
      }
      if (items.length > 0) {
        log("broadcast", items.length, "items from Telegram");
        setStrikeNews("telegram", items);
      }
    } catch (e) {
      console.error("[strikeNews:telegram] poll error:", e?.message || e);
      clientReady = false;
    }
  }

  async function loop() {
    if (!apiId || !apiHash) {
      log("TELEGRAM_API_ID and TELEGRAM_API_HASH required. Get from my.telegram.org");
      return;
    }
    const c = await getClient();
    if (!c) {
      log("Run once: node scripts/telegram-login.js");
      return;
    }
    log("loop started, channels:", channelList.join(", "), "interval", POLL_INTERVAL_MS / 1000, "s");
    while (true) {
      await pollOnce();
      await sleep(POLL_INTERVAL_MS);
    }
  }

  return { pollOnce, loop };
}

module.exports = { createTelegramPoller };
