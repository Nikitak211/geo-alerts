/**
 * Trigger when inference completes: enqueue screenshot job.
 */

export interface OnInferenceReadyDeps {
  /** Enqueue a screenshot for the given alert ID. Receives options with caption and optional focusLat/focusLon. */
  enqueueScreenshot: (alertId: string, options?: OnInferenceReadyOptions) => void;
}

export interface OnInferenceReadyOptions {
  /** Caption for Telegram (e.g. Google Maps link + metadata). */
  caption?: string;
  /** Map focus lat (same as Telegram link) so screenshot shows this location. */
  focusLat?: number;
  /** Map focus lon (same as Telegram link). */
  focusLon?: number;
}

/**
 * Called after inference has been run and broadcast.
 * Enqueues a screenshot job; pass focusLat/focusLon so the map centers on the same point as the Google link.
 */
export function onInferenceReady(
  alertId: string,
  deps: OnInferenceReadyDeps,
  options?: OnInferenceReadyOptions
): void {
  deps.enqueueScreenshot(alertId, options);
}
