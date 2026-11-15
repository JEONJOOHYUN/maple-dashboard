import assert from "node:assert/strict";
import { test } from "node:test";
import { eventGroups, eventRounds, inGroup, roundDates, roundName, roundOfDay, roundsPerCard, splitGroup, starEventKind, starEventOn } from "./events.ts";
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
  const [group] = eventGroups([{ t: at("2026-11-09"), k: "미라클 타임" }], (r) => r.t, (r) => r.k);
  const [round] = group.rounds;
  assert.equal(inGroup(group, round, at("2026-11-09", 30), "미라클 타임"), true);
  // The same day without the event is not in the round, nor another day with it.
  assert.equal(inGroup(group, round, at("2026-11-09", 30), ""), false);
  assert.equal(inGroup(group, round, at("2026-11-10"), "미라클 타임"), false);
  // Without a round picked, every day of the event counts.
  assert.equal(inGroup(group, undefined, at("2026-11-10"), "미라클 타임"), true);
});

test("each event has its own rounds; a day with two events is in both", () => {
  const recs: Rec[] = [
    { t: at("2026-11-06"), k: "샤타포스" },
    { t: at("2026-11-07"), k: "샤타포스 · 1+1" },
    { t: at("2026-11-08"), k: "샤타포스" },
    { t: at("2026-10-03"), k: "30% 할인" },
  ];
  const groups = eventGroups(recs, (r) => r.t, (r) => r.k);
  assert.deepEqual(
    groups.map((g) => [g.label, g.rounds.length]),
    [["이벤트 전체", 4], ["샤타포스", 1], ["30% 할인", 1], ["1+1", 1]]
  );
  const [all, shining, , plus] = groups;
  // One 샤타포스 round over the three days, whatever else was on in the middle.
  assert.equal(roundName(shining, shining.rounds[0]), "11월 6일 ~ 8일");
  assert.equal(roundName(plus, plus.rounds[0]), "11월 7일(토)");
  assert.equal(roundName(all, all.rounds[0]), "샤타포스 · 11월 8일(일)");
  // 1+1 counts the tries with 1+1 on; 샤타포스 counts that day's 샤타포스 tries too.
  assert.equal(inGroup(plus, undefined, at("2026-11-07"), "샤타포스"), false);
  assert.equal(inGroup(shining, undefined, at("2026-11-07"), "샤타포스 · 1+1"), true);
  assert.equal(inGroup(all, undefined, at("2026-11-07"), ""), false);
  assert.equal(roundOfDay(shining).get("2026-11-07"), 0);
});

test("a single event has no 이벤트 전체 choice", () => {
  const groups = eventGroups([{ t: at("2026-11-09"), k: "미라클 타임" }], (r) => r.t, (r) => r.k);
  assert.deepEqual(groups.map((g) => g.label), ["미라클 타임"]);
  assert.deepEqual(eventGroups<Rec>([], (r) => r.t, (r) => r.k), []);
});

test("a group splits into its rounds, and cards count the rounds they were in", () => {
  const recs = [
    { t: at("2026-11-01"), k: "샤타포스", c: "a" },
    { t: at("2026-11-01", 1), k: "", c: "a" },
    { t: at("2026-11-08"), k: "샤타포스", c: "a" },
    { t: at("2026-11-08", 1), k: "샤타포스", c: "b" },
  ];
  const [group] = eventGroups(recs, (r) => r.t, (r) => r.k);
  const { all, rounds: byRound } = splitGroup(recs, group, (r) => r.t, (r) => r.k);
  assert.equal(all.length, 3);
  assert.deepEqual(byRound.map((l) => l.length), [2, 1]);
  assert.deepEqual([...roundsPerCard(byRound, (r) => r.c)].sort(), [["a", 2], ["b", 1]]);
});
