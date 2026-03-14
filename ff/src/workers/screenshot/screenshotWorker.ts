/**
 * Screenshot worker: given an alert ID, capture the render page and save PNG.
 */

import { renderMapScreenshot } from "./renderMapScreenshot";
import type { ScreenshotMetadata } from "./renderMapScreenshot";

export type { ScreenshotMetadata, RenderMapScreenshotOptions } from "./renderMapScreenshot";
export { renderMapScreenshot };

/**
 * Run the screenshot worker for one alert ID.
 * Returns metadata or throws on failure.
 */
export async function runScreenshotWorker(
  alertId: string,
  options?: Parameters<typeof renderMapScreenshot>[1]
): Promise<ScreenshotMetadata> {
  return renderMapScreenshot(alertId, options);
}

/** CLI: node dist/workers/screenshot/screenshotWorker.js <alertId> */
async function main(): Promise<void> {
  const alertId = process.argv[2];
  if (!alertId) {
    console.error("Usage: node screenshotWorker.js <alertId>");
    process.exit(1);
  }
  try {
    const meta = await runScreenshotWorker(alertId);
    console.log(JSON.stringify(meta, null, 2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}
