/**
 * Enqueue screenshot: run worker in background, persist metadata, broadcast, optionally post to Telegram.
 */

import * as path from "path";
import type { Pool } from "pg";
import { renderMapScreenshot, ScreenshotSkippedSafetyError } from "./renderMapScreenshot";
import { persistScreenshot } from "../../storage/repositories/screenshotRepository";
import { sendPhotoToTelegram } from "../telegram/sendToTelegram";

export interface EnqueueScreenshotDeps {
  /** Callback to broadcast a message (e.g. screenshot_ready). */
  broadcast: (data: unknown) => void;
  /** Directory to save PNGs. */
  storagePath?: string;
  /** Base URL of the client app for Playwright (e.g. http://localhost:4421). */
  clientBaseUrl?: string;
  /** Base URL for screenshot download (e.g. http://localhost:8090/api/screenshots). */
  screenshotPublicUrl: string;
  /** Optional DB pool to persist screenshot metadata. */
  pool?: Pool;
}

/**
 * Enqueue a screenshot job for the given alert ID.
 * Runs the worker in the background; when done, persists metadata (if pool provided), then broadcasts screenshot_ready.
 * @param captionOrOptions - Caption string for Telegram, or { caption, focusLat, focusLon } so the map centers on the same point as the Google link.
 */
export function enqueueScreenshot(
  alertId: string,
  deps: EnqueueScreenshotDeps,
  captionOrOptions?: string | { caption?: string; focusLat?: number; focusLon?: number }
): void {
  const {
    broadcast,
    storagePath,
    clientBaseUrl,
    screenshotPublicUrl,
    pool,
  } = deps;

  const caption = typeof captionOrOptions === "string" ? captionOrOptions : captionOrOptions?.caption;
  const focusLat = typeof captionOrOptions === "object" ? captionOrOptions?.focusLat : undefined;
  const focusLon = typeof captionOrOptions === "object" ? captionOrOptions?.focusLon : undefined;

  renderMapScreenshot(alertId, {
    baseUrl: clientBaseUrl,
    storagePath,
    focusLat,
    focusLon,
  })
    .then(async (meta) => {
      const filename = path.basename(meta.path);
      const url = `${screenshotPublicUrl.replace(/\/$/, "")}/${filename}`;
      if (pool) {
        try {
          await persistScreenshot(pool, {
            alertId: meta.alertId,
            path: meta.path,
            url,
            createdAt: meta.createdAt,
            width: meta.width,
            height: meta.height,
            theme: meta.theme,
            algorithmVersion: meta.algorithmVersion,
          });
        } catch (e) {
          console.error("[screenshot] persist failed:", (e as Error)?.message ?? e);
        }
      }
      broadcast({
        type: "screenshot_ready",
        ts: Date.now(),
        payload: {
          alertId: meta.alertId,
          url,
          path: meta.path,
          createdAt: meta.createdAt,
          width: meta.width,
          height: meta.height,
          theme: meta.theme,
          algorithmVersion: meta.algorithmVersion,
        },
      });

      sendPhotoToTelegram({
        filePath: meta.path,
        caption: caption ?? "Launch Exit Location",
      }).then((sent) => {
        if (sent) console.log("[screenshot] posted to Telegram channel");
      }).catch((e) => {
        console.error("[screenshot] Telegram post failed:", (e as Error)?.message ?? e);
      });
    })
    .catch((e) => {
      if (e instanceof ScreenshotSkippedSafetyError) {
        console.warn("[screenshot] skipped for safety (dev/build errors visible)");
        return;
      }
      console.error("[screenshot] capture failed:", (e as Error)?.message ?? e);
    });
}
