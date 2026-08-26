import test from "node:test";
import assert from "node:assert/strict";
import {
  getBucketKey, getBusinessDateKey, getDateRange, getDefaultChartRange,
  getHourlyBucketKeys, getMonthRange, getPeriodRange, getYearRange, normalizeBusinessRange,
} from "../src/shared/utils/timeRange.js";

const timezone = "Asia/Beirut";

test("05:59:59 belongs to the previous business day", () => {
  assert.equal(getBusinessDateKey("2026-08-27T02:59:59.000Z", timezone), "2026-08-26");
});

test("06:00:00 starts the new business day", () => {
  assert.equal(getBusinessDateKey("2026-08-27T03:00:00.000Z", timezone), "2026-08-27");
});

test("23:59:59 belongs to the current business day", () => {
  assert.equal(getBusinessDateKey("2026-08-27T20:59:59.000Z", timezone), "2026-08-27");
});

test("00:00:00 belongs to the business day that began the previous morning", () => {
  assert.equal(getBusinessDateKey("2026-08-27T21:00:00.000Z", timezone), "2026-08-27");
});

test("daily, monthly, and yearly ranges use tenant-local 06:00 boundaries", () => {
  assert.deepEqual(getDateRange("2026-08-26", timezone), {
    from: "2026-08-26T03:00:00.000Z", to: "2026-08-27T03:00:00.000Z",
  });
  assert.deepEqual(getMonthRange(2026, 8, timezone), {
    from: "2026-08-01T03:00:00.000Z", to: "2026-09-01T03:00:00.000Z",
  });
  assert.deepEqual(getYearRange(2026, timezone), {
    from: "2026-01-01T04:00:00.000Z", to: "2027-01-01T04:00:00.000Z",
  });
});

test("current periods before 06:00 use the previous business date", () => {
  const now = new Date("2026-09-01T01:00:00.000Z"); // 04:00 in Beirut
  assert.deepEqual(getPeriodRange("today", timezone, now), {
    from: "2026-08-31T03:00:00.000Z", to: "2026-09-01T03:00:00.000Z",
  });
  assert.deepEqual(getPeriodRange("month", timezone, now), {
    from: "2026-08-01T03:00:00.000Z", to: "2026-09-01T03:00:00.000Z",
  });
});

test("a session crossing midnight stays assigned by its completion business date", () => {
  const startedAt = "2026-08-26T20:30:00.000Z"; // 23:30
  const endedAt = "2026-08-26T23:30:00.000Z"; // 02:30 next calendar day
  assert.equal(getBusinessDateKey(startedAt, timezone), "2026-08-26");
  assert.equal(getBucketKey(endedAt, "daily", timezone), "2026-08-26");
});

test("a session crossing 06:00 is recognized on the new business day when it ends", () => {
  const startedAt = "2026-08-27T02:30:00.000Z"; // 05:30
  const endedAt = "2026-08-27T03:30:00.000Z"; // 06:30
  assert.equal(getBusinessDateKey(startedAt, timezone), "2026-08-26");
  assert.equal(getBucketKey(endedAt, "daily", timezone), "2026-08-27");
});

test("DST-short business days generate the correct UTC query and hourly buckets", () => {
  const range = getDateRange("2026-03-07", "America/New_York");
  assert.deepEqual(range, {
    from: "2026-03-07T11:00:00.000Z", to: "2026-03-08T10:00:00.000Z",
  });
  assert.equal(getHourlyBucketKeys(range).length, 23);
});

test("rolling dashboard ranges also begin and end at business-day boundaries", () => {
  assert.deepEqual(getDefaultChartRange("daily", timezone, new Date("2026-08-27T12:00:00.000Z")), {
    from: "2026-07-29T03:00:00.000Z", to: "2026-08-28T03:00:00.000Z",
  });
});

test("date-only API filters normalize to tenant business-day boundaries", () => {
  assert.deepEqual(normalizeBusinessRange({ from: "2026-08-26", to: "2026-08-28" }, timezone), {
    from: "2026-08-26T03:00:00.000Z",
    to: "2026-08-28T03:00:00.000Z",
  });
});
