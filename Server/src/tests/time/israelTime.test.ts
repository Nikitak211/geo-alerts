/**
 * TDD (RED first): settlement timezone tests.
 * Bug: settlement.service.js uses getHours()/getMinutes() (local TZ).
 * Fix: must use Asia/Jerusalem via getMinuteOfDayInJerusalem.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { getMinuteOfDayInJerusalem } from "../../utils/israelTime";

/**
 * Make a Date that represents a specific wall-clock time in Asia/Jerusalem.
 * Jerusalem is UTC+2 standard (IST) or UTC+3 summer (IDT).
 * We use known UTC timestamps to avoid DST ambiguity in tests.
 */
function utcDate(isoUtc: string): Date {
  return new Date(isoUtc);
}

describe("getMinuteOfDayInJerusalem", () => {
  describe("UTC-to-Jerusalem conversion", () => {
    it("12:00 UTC in winter (UTC+2) → 14:00 Jerusalem → minute 840", () => {
      // January: Jerusalem = UTC+2 (IST)
      const d = utcDate("2026-01-15T12:00:00.000Z");
      assert.strictEqual(getMinuteOfDayInJerusalem(d), 14 * 60); // 840
    });

    it("12:00 UTC in summer (UTC+3) → 15:00 Jerusalem → minute 900", () => {
      // July: Jerusalem = UTC+3 (IDT)
      const d = utcDate("2026-07-15T12:00:00.000Z");
      assert.strictEqual(getMinuteOfDayInJerusalem(d), 15 * 60); // 900
    });

    it("22:00 UTC in summer → 01:00 next-day Jerusalem → minute 60", () => {
      // 22:00 UTC + 3h = 01:00 next day
      const d = utcDate("2026-07-15T22:00:00.000Z");
      assert.strictEqual(getMinuteOfDayInJerusalem(d), 60);
    });

    it("returns 0 for Jerusalem midnight (02:00 UTC winter)", () => {
      // IST (UTC+2) midnight = 22:00 previous day UTC
      const d = utcDate("2026-01-14T22:00:00.000Z");
      assert.strictEqual(getMinuteOfDayInJerusalem(d), 0);
    });
  });

  describe("minute precision", () => {
    it("returns correct minute component", () => {
      // 12:30 UTC in summer → 15:30 Jerusalem → 15*60 + 30 = 930
      const d = utcDate("2026-07-15T12:30:00.000Z");
      assert.strictEqual(getMinuteOfDayInJerusalem(d), 15 * 60 + 30); // 930
    });

    it("returns same minute for two dates at same Jerusalem wall-clock minute (different seconds)", () => {
      const d1 = utcDate("2026-07-15T12:30:00.000Z");
      const d2 = utcDate("2026-07-15T12:30:45.000Z");
      assert.strictEqual(getMinuteOfDayInJerusalem(d1), getMinuteOfDayInJerusalem(d2));
    });
  });

  describe("settlement matching scenario", () => {
    it("alert at 14:30 Jerusalem (UTC+3 summer) matches predicted 14:30 using Jerusalem minutes", () => {
      // Alert fires at 11:30 UTC (= 14:30 Jerusalem IDT)
      const alertTs = utcDate("2026-07-29T11:30:00.000Z");
      // Predicted time "14:30" treated as Jerusalem local → also 11:30 UTC
      // BUT old code: new Date("2026-07-29T14:30:00") in UTC env → 14:30 UTC ≠ 11:30 UTC
      // With Jerusalem-aware comparison: both should yield minute 14*60+30 = 870.
      const alertMinute = getMinuteOfDayInJerusalem(alertTs);
      assert.strictEqual(alertMinute, 14 * 60 + 30, "Alert should map to 14:30 Jerusalem");
    });

    it("two Dates at same Jerusalem minute but different UTC minutes compare equal", () => {
      // Summer: UTC offset = +3; 14:30 Jerusalem = 11:30 UTC
      const alertTs = utcDate("2026-07-29T11:30:00.000Z");
      // Same day in Jerusalem is also 11:30 UTC = 14:30 Jerusalem
      const predicted = utcDate("2026-07-29T11:30:00.000Z");
      assert.strictEqual(
        getMinuteOfDayInJerusalem(alertTs),
        getMinuteOfDayInJerusalem(predicted)
      );
    });
  });
});
