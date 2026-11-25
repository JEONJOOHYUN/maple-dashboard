import assert from "node:assert/strict";
import { test } from "node:test";
import { charHomework, type HomeworkState } from "./model.ts";
import { fillThin, isThin, latestFull, registrationsOf } from "./thin.ts";
import { bossRows } from "../revenue/calc.ts";

const boss = (content_name: string, difficulty: string, registered: boolean, cleared: boolean, cycle = "bossWeekly") => ({
  content_name,
  difficulty,
  cycle,
  registration_flag: String(registered),
  complete_flag: String(cleared),
});
// A full answer lists every boss: padded with unregistered ones as NEXON does (82 rows in 2026-11).
const others = Array.from({ length: 30 }, (_, i) => boss(`다른 보스 ${i}`, "NORMAL", false, false));
const full: HomeworkState = {
  boss_contents: [boss("카오스 벨룸", "CHAOS", true, true), boss("하드 루시드", "HARD", true, true), boss("검은 마법사", "HARD", true, true, "bossMonthly"), ...others],
  daily_contents: [
    { content_name: "몬스터파크", type: "contents", registration_flag: "true", now_count: 14, max_count: 14 },
    { content_name: "[일일 퀘스트] 기억의 늪", type: "quest", registration_flag: "true", quest_state: "2" },
    { content_name: "에르다 스펙트럼", type: "contents", registration_flag: "false", now_count: 0, max_count: 3 },
  ],
  weekly_contents: [],
  weekly_boss_clear_count: 2,
};
// Right after the Thursday reset, not logged in since: the monthly clear and one daily row, nothing registered.
const thin: HomeworkState = {
  boss_contents: [boss("검은 마법사", "HARD", false, true, "bossMonthly")],
  daily_contents: [{ content_name: "몬스터파크", type: "contents", registration_flag: "false", now_count: 0, max_count: 14 }],
  weekly_contents: [],
  weekly_boss_clear_count: 0,
};

test("thin answer: told apart by its few boss rows", () => {
  assert.equal(isThin(thin), true);
  assert.equal(isThin(full), false);
});

test("thin answer, filled: the registered bosses and dailies are back and not done; what today has cleared stays", () => {
  const before = charHomework(thin);
  assert.equal(before.bosses.total + before.today.total, 0, "read as it comes, nothing is registered — 다 끝남");
  const hw = charHomework(fillThin(thin, registrationsOf(full)));
  assert.deepEqual(hw.bosses.items.map((b) => [b.name, b.done]), [["카오스 벨룸", false], ["하드 루시드", false]]);
  assert.deepEqual(hw.monthly.items.map((b) => [b.name, b.done]), [["검은 마법사", true]]);
  assert.deepEqual(hw.today.items.map((i) => i.done), [false]);
  // Boss revenue reads the same rows: the registered weekly bosses are there, not cleared.
  const rows = bossRows(fillThin(thin, registrationsOf(full)));
  assert.equal(rows.filter((r) => !r.monthly && !r.done).length, 2);
});

test("thin answer: a full answer, or nothing to fill from, is left as it came", () => {
  assert.equal(fillThin(full, registrationsOf(full)), full);
  assert.equal(fillThin(thin, null), thin);
});

test("the latest full day: yesterday not ready and a thin day are skipped", async () => {
  const now = Date.parse("2026-11-26T00:30:00+09:00");
  const asked: string[] = [];
  const found = await latestFull(now, async (date) => {
    asked.push(date);
    return date === "2026-11-25" ? { kind: "busy" } : { body: date === "2026-11-24" ? thin : full };
  });
  assert.deepEqual(asked, ["2026-11-25", "2026-11-24", "2026-11-23"]);
  assert.equal(found?.boss_contents?.length, 3, "only the registered rows are kept");
});

test("the latest full day: none in 14 days is null; the oldest day past NEXON's reach is skipped", async () => {
  const now = Date.parse("2026-11-26T00:30:00+09:00");
  let n = 0;
  assert.equal(await latestFull(now, async () => (++n === 14 ? { kind: "failed" } : { body: thin })), null);
  assert.equal(n, 14);
});

test("the latest full day: any other refusal stops the search and throws (so it is not kept as none found)", async () => {
  const now = Date.parse("2026-11-26T00:30:00+09:00");
  for (const [kind, at] of [["failed", 1], ["busy", 2], ["quota", 1], ["badKey", 3]] as const) {
    let n = 0;
    await assert.rejects(latestFull(now, async () => (++n === at ? { kind } : { body: thin })), new RegExp(kind));
    assert.equal(n, at, kind + " stops at once");
  }
});
