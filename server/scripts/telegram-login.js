#!/usr/bin/env node
/**
 * One-time Telegram login. Creates a session for reading public channels (no bot).
 * You need api_id and api_hash from https://my.telegram.org
 *
 * Usage:
 *   TELEGRAM_API_ID=12345 TELEGRAM_API_HASH=abc... node scripts/telegram-login.js
 *
 * Or add to server/.env and run:
 *   node scripts/telegram-login.js
 *
 * You'll be prompted for phone (with country code), then the code Telegram sends you.
 * Session is saved to ./telegram_session (or TELEGRAM_SESSION_PATH).
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const readline = require("readline");

const apiId = process.env.TELEGRAM_API_ID ? parseInt(process.env.TELEGRAM_API_ID, 10) : null;
const apiHash = process.env.TELEGRAM_API_HASH || null;
// StoreSession joins with cwd – use relative folder name only
const sessionPath = process.env.TELEGRAM_SESSION_PATH || "telegram_session";

if (!apiId || !apiHash) {
  console.error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH (from https://my.telegram.org)");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

(async () => {
  try {
    const { TelegramClient } = require("telegram");
    const { StoreSession } = require("telegram/sessions");
    const session = new StoreSession(sessionPath);
    const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });

    await client.start({
      phoneNumber: () => ask("Phone number (with country code, e.g. +1234567890): "),
      password: () => ask("2FA password (if any, else press Enter): "),
      phoneCode: () => ask("Code from Telegram: "),
      onError: (err) => console.error(err),
    });

    console.log("Logged in. Session saved to:", sessionPath);
    console.log("You can now start the server – it will read public channels without a bot.");
    await client.disconnect();
  } catch (e) {
    console.error("Login failed:", e?.message || e);
    process.exit(1);
  } finally {
    rl.close();
  }
})();
