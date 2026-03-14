/**
 * Send a screenshot (or any image file) to a Telegram channel via Bot API.
 * Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID in env to enable.
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import FormData from "form-data";

const TELEGRAM_API = "https://api.telegram.org";

export interface SendToTelegramOptions {
  /** Path to the image file (PNG/JPEG). */
  filePath: string;
  /** Optional caption (supports HTML when parse_mode is set). */
  caption?: string;
  /** Bot token (default: process.env.TELEGRAM_BOT_TOKEN). */
  botToken?: string;
  /** Channel ID or @channel_username (default: process.env.TELEGRAM_CHANNEL_ID). */
  channelId?: string;
}

function readResponseBody(res: import("http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    res.on("data", (chunk: Buffer) => chunks.push(chunk));
    res.on("error", reject);
    res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

/**
 * Send photo to Telegram channel. No-op if token or channel not configured.
 * Returns true if sent, false if skipped, throws on API error.
 */
export async function sendPhotoToTelegram(options: SendToTelegramOptions): Promise<boolean> {
  const token = options.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.channelId ?? process.env.TELEGRAM_CHANNEL_ID;

  if (!token?.trim() || !chatId?.trim()) {
    console.warn("[Telegram] Skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID not set");
    return false;
  }

  if (!fs.existsSync(options.filePath)) {
    throw new Error(`Telegram: file not found: ${options.filePath}`);
  }

  const form = new FormData();
  form.append("chat_id", chatId.trim());
  form.append("photo", fs.createReadStream(options.filePath), {
    filename: path.basename(options.filePath),
    contentType: "image/png",
  });
  if (options.caption) {
    form.append("caption", options.caption);
    form.append("parse_mode", "HTML");
  }

  const url = `${TELEGRAM_API}/bot${token.trim()}/sendPhoto`;
  const urlObj = new URL(url);

  const res = await new Promise<import("http").IncomingMessage>((resolve, reject) => {
    const opts = {
      protocol: urlObj.protocol,
      host: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: form.getHeaders(),
    };
    const req = https.request(opts, (r) => resolve(r));
    req.on("error", reject);
    form.pipe(req);
  });

  const body = await readResponseBody(res);
  const json = JSON.parse(body) as { ok?: boolean; description?: string; error_code?: number };

  if (res.statusCode !== 200 || !json.ok) {
    const msg = json.description ?? `Telegram API ${res.statusCode}`;
    console.error("[Telegram] API error:", json.description, "status:", res.statusCode, "body:", body);
    throw new Error(msg);
  }

  return true;
}
