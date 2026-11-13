import assert from "node:assert/strict";
import { test } from "node:test";
import benefits from "./data/benefits.json" with { type: "json" };
import { BUNDLES, bundleOf } from "./bundles.ts";
import { SUNDAYS, addWeeks, dateLabel, upcomingSunday } from "./history.ts";
import { bigDayWindow, predictSunday, themesOf } from "./predict.ts";

const groupOf = new Map(benefits.map((b) => [b.name, b.group]));

test("every benefit in the data maps to a labelled bundle", () => {
  for (const b of benefits) {
    const id = bundleOf({ name: b.name }, (n) => groupOf.get(n) ?? "etc");
    assert.ok(BUNDLES[id], `no bundle label for ${b.name} -> ${id}`);
  }
});

test("history has every Sunday from the first record (2024-03-31 moved to Monday)", () => {
  const dates = new Set(SUNDAYS.map((w) => w.date));
  for (let d = SUNDAYS[0].date; d <= SUNDAYS[SUNDAYS.length - 1].date; d = addWeeks(d, 1)) {
    if (d === "2024-03-31") continue;
    assert.ok(dates.has(d), `missing ${d}`);
  }
});

// Pins the backtest that chose this model (C:/dev/_work/maple-sunday-data/exp/diversify.mjs, v3 + one per kind):
// a port mistake would change these counts.
function backtest(from: string, to: string) {
  let top3 = 0;
  let n = 0;
  for (const w of SUNDAYS.filter((x) => x.date >= from && x.date <= to && x.bundles.size)) {
    const p = predictSunday(SUNDAYS, w.date);
    n++;
    if (p.picks.slice(0, 3).some((id) => w.bundles.has(id))) top3++;
  }
  return { top3, n };
}
test("backtest: last 52 weeks 38/52, maplessunday's 27 weeks 22/27", () => {
  assert.deepEqual(backtest("2025-11-16", "2026-11-08"), { top3: 38, n: 52 });
  assert.deepEqual(backtest("2026-05-10", "2026-11-08"), { top3: 22, n: 27 });
});

test("prediction shape: picks cover different kinds, probabilities stay in 0..1", () => {
  const p = predictSunday(SUNDAYS, "2026-11-15");
  assert.equal(p.picks.length, 5);
  assert.equal(new Set(p.picks).size, 5);
  for (const r of p.ranked) assert.ok(r.p >= 0 && r.p <= 1, r.id);
  for (const v of Object.values(p.themes)) assert.ok(v >= 0 && v <= 1);
  assert.equal(p.missingWeeks, 0);
  // two weeks past the data: one Sunday unknown
  assert.equal(predictSunday(SUNDAYS, "2026-11-22").missingWeeks, 1);
});

test("big day is unlikely right after one", () => {
  // 2026-11-01 was shining; the next week the model should not put a big day first
  const p = predictSunday(SUNDAYS, "2026-11-08");
  assert.notEqual(p.ranked[0].id, "shining");
  assert.ok(p.themes.hunt > p.themes.starforce);
});

test("themes of recorded weeks", () => {
  const w = (d: string) => SUNDAYS.find((x) => x.date === d)!;
  assert.deepEqual(themesOf(w("2026-11-01")), ["starforce"]); // shining
  assert.deepEqual(themesOf(w("2026-11-08")), ["hunt"]); // treasure hunter + monster park
  assert.deepEqual(themesOf(w("2026-10-11")), ["starforce", "enhance"]); // ability + destroy -30%
});

test("Korea-time week helpers", () => {
  assert.equal(upcomingSunday(new Date("2026-11-10T03:00:00Z")), "2026-11-15"); // Tue noon KST
  assert.equal(upcomingSunday(new Date("2026-11-14T16:00:00Z")), "2026-11-15"); // Sun 01:00 KST
  assert.equal(upcomingSunday(new Date("2026-11-15T15:30:00Z")), "2026-11-22"); // Mon 00:30 KST
  assert.equal(dateLabel("2026-11-15"), "11월 15일(일)");
});

test("page data: recorded week, Friday notice time, stale data", async () => {
  const { getSundayPageData } = await import("./view.ts");
  // Saturday 2026-11-07 KST: this Sunday (11-08) is recorded -> show it, predict 11-15
  const sat = getSundayPageData(new Date("2026-11-07T03:00:00Z"));
  assert.equal(sat.thisWeek.date, "2026-11-08");
  assert.equal(sat.thisWeek.recorded?.title, "사냥데이");
  assert.equal(sat.prediction.date, "2026-11-15");
  // The home card: days left (0 on the Sunday itself), and each benefit as name · amount.
  assert.deepEqual([sat.thisWeek.daysLeft, getSundayPageData(new Date("2026-11-08T03:00:00Z")).thisWeek.daysLeft], [1, 0]);
  assert.equal(sat.thisWeek.recorded!.rows.length, sat.thisWeek.recorded!.items.length);
  assert.equal(sat.thisWeek.recorded!.updated, null);
  // A week the Cron read carries the time it was read, shown in Korea time.
  const { mergeStored } = await import("./stored.ts");
  const { SUNDAYS } = await import("./history.ts");
  const stored = mergeStored(SUNDAYS, [{ sunday: "2026-11-15", notice_id: 1409, special: false, items: [{ name: "주문의 흔적 강화 비용 50% 할인" }], updated_at: "2026-11-13T01:53:31.000Z", images: ["https://lwi.nexon.com/maplestory/2026/a.png", "https://example.com/b.png", 7] }]);
  const live = getSundayPageData(new Date("2026-11-13T03:00:00Z"), stored).thisWeek;
  assert.deepEqual([live.daysLeft, live.recorded?.updated, live.recorded?.rows[0]], [2, "11월 13일(금) 10:53", { name: "주문의 흔적 강화 비용", amount: "50% 할인" }]);
  assert.equal(live.recorded?.noticeUrl, "https://maplestory.nexon.com/News/Event/1409");
  // The notice's pictures: NEXON's addresses only. A week of the bundled history has none.
  assert.deepEqual(live.recorded?.images, ["https://lwi.nexon.com/maplestory/2026/a.png"]);
  assert.deepEqual(sat.thisWeek.recorded!.images, []);
  // Friday 2026-11-13 09:59 KST: not announced yet; 10:00 KST: announced, still unrecorded -> predict 11-15
  assert.equal(getSundayPageData(new Date("2026-11-13T00:59:00Z")).thisWeek.announced, false);
  const fri = getSundayPageData(new Date("2026-11-13T01:00:00Z"));
  assert.equal(fri.thisWeek.announced, true);
  assert.equal(fri.thisWeek.recorded, null);
  assert.equal(fri.prediction.date, "2026-11-15");
  // data not updated for a week: warn
  assert.equal(getSundayPageData(new Date("2026-11-17T03:00:00Z")).prediction.missingWeeks, 1);
  // shining week detail shows the actual benefits, not the title again
  const nov1 = sat.recent.find((w) => w.date === "2026-11-01")!;
  assert.equal(nov1.title, "샤이닝 스타포스 타임");
  assert.ok(nov1.detail.includes("파괴 확률"));
});

test("five shown picks: 45/52 over the last year, 27/27 on maplessunday's 27 weeks", () => {
  const hits = (from: string, to: string) => {
    const weeks = SUNDAYS.filter((x) => x.date >= from && x.date <= to && x.bundles.size);
    return [weeks.filter((w) => predictSunday(SUNDAYS, w.date).picks.some((id) => w.bundles.has(id))).length, weeks.length];
  };
  assert.deepEqual(hits("2025-11-16", "2026-11-08"), [45, 52]);
  assert.deepEqual(hits("2026-05-10", "2026-11-08"), [27, 27]);
});

test("big day window: last time + the usual gap (shining 4~6 weeks in 8 of 13 gaps since 2025-03)", () => {
  const w = bigDayWindow(SUNDAYS, "shining", "2026-11-15")!;
  assert.deepEqual({ last: w.last, min: w.minWeeks, max: w.maxWeeks, covered: w.covered, total: w.total, since: w.sinceWeeks }, { last: "2026-11-01", min: 4, max: 6, covered: 8, total: 13, since: 2 });
  assert.equal(addWeeks(w.last!, w.minWeeks), "2026-11-29");
  assert.equal(addWeeks(w.last!, w.maxWeeks), "2026-12-13");
  const m = bigDayWindow(SUNDAYS, "miracle", "2026-11-15")!;
  assert.equal(m.last, "2026-09-27");
  assert.ok(m.covered >= 3 && m.total === 8);
  // Too few appearances: no window.
  assert.equal(bigDayWindow(SUNDAYS, "shining", "2025-06-01"), null);
});
