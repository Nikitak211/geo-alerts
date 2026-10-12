import { newsNoticeText } from "./NewsStatusNotice";

const base = { available: true, count: 5, source: "gdelt", updatedAt: "2026-10-12T06:00:00Z", stale: false, lastError: null };

test("no notice when news is live from GDELT", () => {
  expect(newsNoticeText(base, false)).toBeNull();
});

test("unavailable when nothing cached or the status call fails", () => {
  expect(newsNoticeText({ ...base, available: false, count: 0 }, false)?.en).toMatch(/unavailable/);
  expect(newsNoticeText(null, true)?.en).toMatch(/unavailable/);
});

test("stale and fallback notices", () => {
  expect(newsNoticeText({ ...base, stale: true }, false)?.en).toMatch(/saved news from 09:00/);
  expect(newsNoticeText({ ...base, source: "rss" }, false)?.en).toMatch(/backup source/);
});
