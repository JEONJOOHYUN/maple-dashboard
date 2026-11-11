import assert from "node:assert/strict";
import test from "node:test";
import { SUNDAYS } from "./history.ts";
import { getSundayPageData } from "./view.ts";

const upTo = (date: string) => SUNDAYS.filter((w) => w.date <= date);

test("the week rolls over at Monday 00:00 KST: Sunday stays 'today' until then", () => {
  const weeks = upTo("2026-11-08");
  // Sunday 2026-11-08 23:59:59 KST
  const sunday = getSundayPageData(new Date("2026-11-08T14:59:59Z"), weeks);
  assert.equal(sunday.thisWeek.date, "2026-11-08");
  assert.equal(sunday.thisWeek.isToday, true);
  assert.ok(sunday.thisWeek.recorded);
  assert.equal(sunday.prediction.date, "2026-11-15");
  // Monday 2026-11-09 00:00:00 KST: the coming Sunday, before its notice
  const monday = getSundayPageData(new Date("2026-11-08T15:00:00Z"), weeks);
  assert.equal(monday.thisWeek.date, "2026-11-15");
  assert.equal(monday.thisWeek.isToday, false);
  assert.equal(monday.thisWeek.recorded, null);
  assert.equal(monday.thisWeek.announced, false);
  assert.equal(monday.prediction.date, "2026-11-15");
});

test("the notice counts as out from Friday 10:00 KST", () => {
  const weeks = upTo("2026-11-08");
  assert.equal(getSundayPageData(new Date("2026-11-13T00:59:59Z"), weeks).thisWeek.announced, false);
  assert.equal(getSundayPageData(new Date("2026-11-13T01:00:00Z"), weeks).thisWeek.announced, true);
});

test("shining / miracle windows read in weeks from the coming Sunday", () => {
  const weeks = upTo("2026-11-08");
  const when = (now: string) =>
    Object.fromEntries(getSundayPageData(new Date(now), weeks).prediction.bigDays.map((d) => [d.id, d.when]));
  // Wednesday 2026-11-11: this week = 11-15. Shining 11-29 ~ 12-13, miracle 11-22 ~ 12-06.
  assert.deepEqual(when("2026-11-11T03:00:00Z"), { shining: "2 ~ 4주 후", miracle: "다음 주 ~ 3주 후" });
  // Saturday 2026-11-07 (11-08 already recorded): this week = 11-08, the prediction is for 11-15.
  assert.deepEqual(when("2026-11-07T03:00:00Z"), { shining: "3 ~ 5주 후", miracle: "2 ~ 4주 후" });
});
