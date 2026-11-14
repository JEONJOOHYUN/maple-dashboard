import assert from "node:assert/strict";
import { test } from "node:test";
import { eventRounds, inRound, roundDates, starEventKind, starEventOn } from "./events.ts";
import { dayStart } from "./kst.ts";

type Rec = { t: number; k: string };
// Noon KST on a day, plus minutes so records of one day keep their order.
const at = (date: string, min = 0) => dayStart(date) + 12 * 3_600_000 + min * 60_000;
const rounds = (recs: Rec[]) => eventRounds(recs, (r) => r.t, (r) => r.k);

test("star force event names follow the try badges", () => {
  assert.equal(starEventKind({ set: "none", sr: 0, plus: 0 }), "");
  assert.equal(starEventOn({ set: "none", sr: 0, plus: 0 }), false);
  assert.equal(starEventKind({ set: "shining", sr: 0, plus: 0 }), "샤타포스");
  assert.equal(starEventKind({ set: "sale30", sr: 100, plus: 1 }), "30% 할인 · 100% 성공 · 1+1");
  assert.equal(starEventOn({ set: "none", sr: 0, plus: 1 }), true);
});

test("round dates read as one day with its weekday, or a range", () => {
  assert.equal(roundDates("2026-11-08", "2026-11-08"), "11월 8일(일)");
  assert.equal(roundDates("2026-10-03", "2026-10-05"), "10월 3일 ~ 5일");
  assert.equal(roundDates("2026-10-31", "2026-11-02"), "10월 31일 ~ 11월 2일");
});

test("days with the same events two days apart at most are one round; weekly Sundays stay apart", () => {
  const list = rounds([
    { t: at("2026-11-01"), k: "샤타포스" },
    { t: at("2026-11-08"), k: "샤타포스" },
    { t: at("2026-10-03"), k: "30% 할인" },
    // A day skipped in a three-day sale is still the same round.
    { t: at("2026-10-05"), k: "30% 할인" },
    { t: at("2026-10-05", 5), k: "" },
  ]);
  assert.deepEqual(
    list.map((r) => r.label),
    ["샤타포스 · 11월 8일(일)", "샤타포스 · 11월 1일(일)", "30% 할인 · 10월 3일 ~ 5일"]
  );
  assert.equal(list[2].dates.size, 2);
});

test("a day's events are named in one order whichever record came first", () => {
  const list = rounds([
    { t: at("2026-11-09", 1), k: "1+1" },
    { t: at("2026-11-09", 2), k: "샤타포스" },
    { t: at("2026-11-16", 1), k: "샤타포스" },
    { t: at("2026-11-16", 2), k: "1+1" },
  ]);
  assert.deepEqual(
    list.map((r) => r.what),
    ["샤타포스 · 1+1", "샤타포스 · 1+1"]
  );
  assert.notEqual(list[0].id, list[1].id);
});

test("a round holds the event records of its days only", () => {
  const [round] = rounds([{ t: at("2026-11-09"), k: "미라클 타임" }]);
  assert.equal(inRound(round, at("2026-11-09", 30), true), true);
  // The same day without the event is not in the round, nor another day with it.
  assert.equal(inRound(round, at("2026-11-09", 30), false), false);
  assert.equal(inRound(round, at("2026-11-10"), true), false);
});
