/**
 * Capture the render page as PNG using Playwright.
 * Opens /render/alert/:id, waits for render-ready, saves screenshot.
 * Skips saving when dev error overlay is visible (safety: no code/paths in screenshots).
 */

import * as path from "path";
import * as fs from "fs";
import { chromium } from "playwright";

export interface ScreenshotMetadata {
  alertId: string;
  path: string;
  createdAt: string;
  width: number;
  height: number;
  theme: string;
  algorithmVersion: string;
}

/** Thrown when we skip saving to avoid capturing dev errors / source code. */
export class ScreenshotSkippedSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScreenshotSkippedSafetyError";
  }
}

/** Substrings that indicate a dev/build error overlay or render failure; do not save or post. */
const UNSAFE_PAGE_MARKERS = [
  "Compiled with problems",
  "webpack compiled",
  "Module not found",
  "ERROR in ",
  "Failed to load",
  "Missing ?id= alert id",
  "TS2802",
  "TS6133",
  "TS1378",
  "TS2345",
  "TS2322",
  "TS2339",
  "TS2459",
  "TS2352",
  "TS7053",
  "TS2300",
];

export interface RenderMapScreenshotOptions {
  /** Base URL of the client app (e.g. http://localhost:4421). */
  baseUrl?: string;
  /** Directory to save PNGs. Defaults to ./screenshots. */
  storagePath?: string;
  /** Viewport width. Default 1280. */
  width?: number;
  /** Viewport height. Default 720. */
  height?: number;
  /** Focus the map on this lat (same as Telegram Google link). */
  focusLat?: number;
  /** Focus the map on this lon (same as Telegram Google link). */
  focusLon?: number;
}

const DEFAULT_BASE_URL = "http://localhost:4421";
const DEFAULT_STORAGE = path.join(process.cwd(), "screenshots");
const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

/**
 * Open the render page for the given alert ID, wait for render-ready, capture PNG.
 * Saves to storage folder and returns metadata.
 */
export async function renderMapScreenshot(
  alertId: string,
  options?: RenderMapScreenshotOptions
): Promise<ScreenshotMetadata> {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const storageDir = options?.storagePath ?? DEFAULT_STORAGE;
  const viewport = {
    width: options?.width ?? DEFAULT_VIEWPORT.width,
    height: options?.height ?? DEFAULT_VIEWPORT.height,
  };

  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const createdAt = new Date().toISOString();

  try {
    const page = await browser.newPage();
    await page.setViewportSize(viewport);

    let url = `${baseUrl.replace(/\/$/, "")}/render/alert/${encodeURIComponent(alertId)}`;
    const { focusLat, focusLon } = options ?? {};
    if (
      typeof focusLat === "number" &&
      Number.isFinite(focusLat) &&
      typeof focusLon === "number" &&
      Number.isFinite(focusLon)
    ) {
      const params = new URLSearchParams({ lat: String(focusLat), lon: String(focusLon) });
      url += `?${params.toString()}`;
    }
    // Use domcontentloaded: networkidle often never fires with map tile layers
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

    await page.waitForFunction(
      () => (window as unknown as { __RENDER_READY__?: boolean }).__RENDER_READY__ === true,
      { timeout: 45000 }
    );

    const pageText = await page.evaluate(() => document.body?.innerText ?? "");
    const hasUnsafeOverlay = UNSAFE_PAGE_MARKERS.some((m) => pageText.includes(m));
    if (hasUnsafeOverlay) {
      throw new ScreenshotSkippedSafetyError(
        "Page shows dev/build errors; screenshot skipped for safety."
      );
    }

    const algorithmVersion = await page.evaluate(() => {
      return (window as unknown as { __ALGORITHM_VERSION__?: string }).__ALGORITHM_VERSION__ ?? "";
    });

    const filename = `alert-${alertId}-${Date.now()}.png`;
    const filePath = path.join(storageDir, filename);
    await page.screenshot({ path: filePath, type: "png" });

    return {
      alertId,
      path: filePath,
      createdAt,
      width: viewport.width,
      height: viewport.height,
      theme: "dark",
      algorithmVersion,
    };
  } finally {
    await browser.close();
  }
}
