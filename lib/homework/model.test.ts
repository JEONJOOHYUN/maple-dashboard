import { test } from "node:test";
import assert from "node:assert/strict";
import { accountHomework, charHomework, contentDone, isAccountWide, leftChips, mergeShared, shortName, summarize, untilDailyReset, type HomeworkState, type SchedulerContent } from "./model.ts";

const kst = (iso: string) => Date.parse(`${iso}+09:00`);
const quest = (name: string, state: string, registered = true): SchedulerContent => ({ content_name: name, type: "quest", registration_flag: String(registered), now_count: 0, max_count: 0, quest_state: state });
const counted = (name: string, now: number, max: number, registered = true): SchedulerContent => ({ content_name: name, type: "contents", registration_flag: String(registered), now_count: now, max_count: max, quest_state: null });
const boss = (name: string, difficulty: string, cycle: string, registered: boolean, done: boolean, order: number) => ({ content_name: name, difficulty, cycle, registration_flag: String(registered), complete_flag: String(done), list_order_no: order });

// Shaped like a real answer: account-wide rows repeat on every character, the rest is the character's own.
const main: HomeworkState = {
  daily_contents: [counted("몬스터파크", 14, 14), quest("[일일 퀘스트] 세르니움 조사", "2"), quest("[일일 퀘스트] 오디움 일대 탐사", "1"), quest("[일일 퀘스트] 리멘 조사", "2", false)],
  weekly_contents: [
    counted("에픽 던전 : 하이마운틴", 0, 0, false),
    counted("에픽 던전 : 악몽선경", 5, 0),
    quest("[메이플 유니온] 주간 드래곤 퇴치", "2", false),
    { ...quest("[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?", "1"), now_count: 2, max_count: 5 },
    counted("에르다 스펙트럼", 0, 1, false),
    counted("[길드] 주간 미션 포인트", 10, 10, false),
    counted("[길드] 지하 수로", 302573, 0),
    counted("[길드] 플래그 레이스", 0, 0),
  ],
  boss_contents: [
    boss("자쿰", "easy", "bossDaily", true, true, 1),
    boss("스우", "hard", "bossWeekly", true, true, 10),
    boss("카링", "normal", "bossWeekly", true, false, 30),
    boss("카링", "hard", "bossWeekly", false, true, 31),
    boss("림보", "normal", "bossWeekly", true, false, 40),
    boss("윌", "hard", "bossWeekly", false, true, 12),
    boss("검은 마법사", "hard", "bossMonthly", true, false, 20),
  ],
  weekly_boss_clear_count: 3,
  weekly_boss_clear_limit_count: 12,
};
// A character that has not been played for a while carries the account-wide rows only.
const idle: HomeworkState = { daily_contents: [counted("몬스터파크", 14, 14)], weekly_contents: [counted("에픽 던전 : 악몽선경", 5, 0), quest("[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?", "2")], boss_contents: [] };

test("a quest is done at state 2, counted contents at their limit or above zero without one", () => {
  assert.equal(contentDone(quest("q", "2")), true);
  assert.equal(contentDone(quest("q", "1")), false);
  assert.equal(contentDone(quest("q", "0")), false);
  assert.equal(contentDone(counted("c", 14, 14)), true);
  assert.equal(contentDone(counted("c", 2, 5)), false);
  assert.equal(contentDone(counted("c", 0, 1)), false);
  // No limit: an epic dungeon cleared this week reads 5, the culvert reads its score.
  assert.equal(contentDone(counted("c", 5, 0)), true);
  assert.equal(contentDone(counted("c", 302573, 0)), true);
  assert.equal(contentDone(counted("c", 0, 0)), false);
});

test("account-wide homework and short names", () => {
  for (const name of ["몬스터파크", "에픽 던전 : 악몽선경", "[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?", "[메이플 유니온] 주간 드래곤 퇴치"]) assert.equal(isAccountWide(name), true, name);
  for (const name of ["[일일 퀘스트] 세르니움 조사", "[길드] 지하 수로", "무릉도장", "에르다 스펙트럼"]) assert.equal(isAccountWide(name), false, name);
  assert.equal(shortName("[일일 퀘스트] 세르니움 조사"), "세르니움 조사");
  assert.equal(shortName("[길드] 지하 수로"), "지하 수로");
  assert.equal(shortName("[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?"), "몬스터파크 익스트림");
  assert.equal(shortName("[메이플 유니온] 주간 드래곤 퇴치"), "유니온 주간 드래곤 퇴치");
  assert.equal(shortName("에픽 던전 : 악몽선경"), "에픽 던전 : 악몽선경");
});

test("a character's own homework: registered rows only, account-wide rows left out", () => {
  const hw = charHomework(main);
  assert.deepEqual(hw.today.items, [
    { name: "세르니움 조사", done: true },
    { name: "오디움 일대 탐사", done: false },
  ]);
  assert.deepEqual(
    hw.week.items.map((i) => [i.name, i.done]),
    [
      ["지하 수로", true],
      ["플래그 레이스", false],
    ]
  );
  // Registered normal and cleared hard = done (hard); cleared without being registered (윌) is not homework; no daily boss.
  assert.deepEqual(hw.bosses.items, [
    { name: "스우", diff: "하드", done: true },
    { name: "카링", diff: "하드", done: true },
    { name: "림보", diff: "노멀", done: false },
  ]);
  assert.deepEqual(hw.monthly.items, [{ name: "검은 마법사", diff: "하드", done: false }]);
  assert.deepEqual([hw.today.done, hw.today.total, hw.week.done, hw.week.total, hw.bosses.done, hw.bosses.total, hw.monthly.done, hw.monthly.total], [1, 2, 1, 2, 2, 3, 0, 1]);
  assert.equal(hw.left, 4);
});

test("a boss registered on the daily list only is not weekly homework", () => {
  const hw = charHomework({
    boss_contents: [
      boss("매그너스", "easy", "bossDaily", true, false, 1),
      boss("매그너스", "hard", "bossWeekly", false, true, 9),
      boss("카링", "hard", "bossWeekly", true, false, 20),
      boss("검은 마법사", "hard", "bossMonthly", false, true, 21),
    ],
  });
  // The weekly 매그너스 was cleared but only its daily one is registered; the monthly boss was cleared without being registered.
  assert.deepEqual(hw.bosses.items, [{ name: "카링", diff: "하드", done: false }]);
  assert.deepEqual(hw.monthly.items, []);
});

test("every row can be shown instead of the registered ones", () => {
  const hw = charHomework(main, () => true);
  assert.deepEqual(hw.today.items.map((i) => i.name), ["세르니움 조사", "오디움 일대 탐사", "리멘 조사"]);
  assert.deepEqual(hw.week.items.find((i) => i.name === "주간 미션 포인트"), { name: "주간 미션 포인트", done: true, progress: "10/10" });
  assert.equal(hw.bosses.items.some((i) => i.name === "윌" && i.done), true);
});

test("no answer for a character = nothing to do, nothing counted", () => {
  for (const state of [null, undefined, {}]) {
    const hw = charHomework(state);
    assert.deepEqual([hw.today.total, hw.week.total, hw.bosses.total, hw.monthly.total, hw.left], [0, 0, 0, 0, 0]);
  }
});

test("account-wide homework is taken once for the account, done when any character says so", () => {
  const hw = accountHomework([null, main, idle]);
  assert.deepEqual(hw.today.items, [{ name: "몬스터파크", done: true, progress: "14/14" }]);
  assert.deepEqual(hw.week.items, [
    { name: "에픽 던전 : 악몽선경", done: true },
    // `main` says 2 of 5, `idle` says done: the done one is kept.
    { name: "몬스터파크 익스트림", done: true },
  ]);
  assert.equal(hw.left, 0);
  // On its own the half-way quest shows how far it is.
  assert.deepEqual(accountHomework([main]).week.items[1], { name: "몬스터파크 익스트림", done: false, progress: "2/5" });
  assert.deepEqual(accountHomework([]), { today: { items: [], done: 0, total: 0 }, week: { items: [], done: 0, total: 0 }, left: 0 });
});

test("the page's four numbers: today, the week's contents, weekly bosses, monthly bosses", () => {
  const sum = summarize([charHomework(main), charHomework(idle)], [accountHomework([main])]);
  assert.deepEqual(sum.today, { done: 2, total: 3, left: 1 });
  assert.deepEqual(sum.week, { done: 2, total: 4, left: 2 });
  assert.deepEqual(sum.bosses, { done: 2, total: 3, left: 1 });
  assert.deepEqual(sum.monthly, { done: 0, total: 1, left: 1 });
  // The same total as the cards add up to.
  assert.equal(sum.today.left + sum.week.left + sum.bosses.left + sum.monthly.left, charHomework(main).left + charHomework(idle).left + accountHomework([main]).left);
});

test("a card's chips: counts for long lists, names for short ones", () => {
  assert.deepEqual(leftChips(charHomework(main)), ["일일 1", "플래그 레이스", "주간 보스 1", "월간 · 검은 마법사"]);
  assert.deepEqual(leftChips(charHomework(idle)), []);
  // More than two weekly rows left: one count instead of the names.
  assert.deepEqual(leftChips(charHomework({ weekly_contents: [counted("무릉도장", 0, 0), counted("에르다 스펙트럼", 0, 1), counted("[길드] 주간 미션 포인트", 3, 10)] })), ["주간 3"]);
  assert.deepEqual(leftChips(charHomework({ weekly_contents: [counted("[길드] 주간 미션 포인트", 3, 10)] })), ["주간 미션 포인트 3/10"]);
});

test("the daily reset is midnight KST", () => {
  assert.deepEqual(untilDailyReset(kst("2026-11-24T18:48:00")), { hours: 5, minutes: 12 });
  assert.deepEqual(untilDailyReset(kst("2026-11-24T23:59:30")), { hours: 0, minutes: 0 });
  assert.deepEqual(untilDailyReset(kst("2026-11-25T00:00:00")), { hours: 24, minutes: 0 });
});

test("an account's homework put together from its characters, one answer each", () => {
  // The same as asking with every answer at once.
  assert.deepEqual(mergeShared([accountHomework([main]), accountHomework([idle]), accountHomework([null])]), accountHomework([main, idle, null]));
  assert.deepEqual(mergeShared([]), accountHomework([]));
});
