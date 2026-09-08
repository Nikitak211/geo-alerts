const { chromium } = require("playwright");

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8080";
const resolveIp = process.env.RESOLVE_IP;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function verifyMobile(browser) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const tileResponses = [];
  page.on("response", (response) => {
    if (/tile\.openstreetmap\.org|tiles\.stadiamaps\.com/.test(response.url())) {
      tileResponses.push({ url: response.url(), status: response.status() });
    }
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".cesium-widget canvas");
  await page.waitForTimeout(2500);

  assert((await page.title()) === "Geo Alerts", "Unexpected document title");
  const feed = await page.locator("aside[aria-label='OREF alert feed']").boundingBox();
  const canvas = await page.locator(".cesium-widget canvas").boundingBox();
  assert(feed && feed.width >= 360, "Mobile alert sheet is not full width");
  assert(canvas && canvas.width >= 380, "Mobile map does not fill the viewport");
  assert(
    (await page.getByRole("button", { name: "Test Alert" }).count()) === 0,
    "Mobile alert sheet should start collapsed",
  );

  await page.getByRole("button", { name: "Expand alert feed" }).click();
  await page.getByRole("button", { name: "Test Alert" }).waitFor();
  await page.getByRole("button", { name: "Collapse alert feed" }).click();

  const pageText = await page.locator("body").innerText();
  assert(!/401 Error|Authentication Error/i.test(pageText), "Map shows an auth error");
  assert(tileResponses.length > 0, "No configured map tiles were requested");
  assert(
    tileResponses.some(({ url, status }) =>
      url.includes("tile.openstreetmap.org") && status === 200
    ),
    "OpenStreetMap fallback did not load successfully",
  );

  await page.close();
  return { feedWidth: feed.width, mapWidth: canvas.width, tileResponses };
}

async function verifyDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".cesium-widget canvas");

  const feed = await page.locator("aside[aria-label='OREF alert feed']").boundingBox();
  const canvas = await page.locator(".cesium-widget canvas").boundingBox();
  assert(feed && feed.width >= 240 && feed.width <= 300, "Desktop sidebar width changed");
  assert(canvas && canvas.width >= 900, "Desktop map is unexpectedly narrow");
  assert(
    (await page.getByRole("button", { name: "Expand alert feed" }).count()) === 0,
    "Desktop should not render the mobile sheet toggle",
  );

  await page.close();
  return { feedWidth: feed.width, mapWidth: canvas.width };
}

(async () => {
  const hostname = new URL(baseUrl).hostname;
  const browser = await chromium.launch({
    headless: true,
    args: resolveIp
      ? [`--host-resolver-rules=MAP ${hostname} ${resolveIp}`]
      : [],
  });
  try {
    const mobile = await verifyMobile(browser);
    const desktop = await verifyDesktop(browser);
    console.log(JSON.stringify({ baseUrl, mobile, desktop }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
