import assert from "node:assert/strict";
import { test } from "node:test";
import { characterIdsOf, characterWorldsOf } from "./client.ts";
import { groupTallies, worldAt, worldGroup, worldRuns } from "./worlds.ts";

test("worlds fall into three groups", () => {
  assert.deepEqual(["엘리시움", "스카니아", "에오스", ""].map(worldGroup), ["regular", "regular", "regular", "regular"]);
  // 챌린저스 and 버닝 together (user, 2026-11-12), whatever the season number.
  assert.deepEqual(["챌린저스", "챌린저스3", "버닝", "버닝2"].map(worldGroup), ["challengers", "challengers", "challengers", "challengers"]);
  // Anything else is an event world.
  assert.deepEqual(["스페셜", "처음 보는 월드"].map(worldGroup), ["event", "event"]);
});

test("count and meso per group, in a fixed order, only what is there", () => {
  const items = [
    { world: "스페셜", spent: 5 },
    { world: "엘리시움", spent: 10 },
    { world: "챌린저스3", spent: 1 },
    { world: "스카니아", spent: 20 },
    { world: "버닝", spent: 2 },
  ];
  assert.deepEqual(groupTallies(items), [
    { id: "regular", n: 2, spent: 30 },
    { id: "challengers", n: 2, spent: 3 },
    { id: "event", n: 1, spent: 5 },
  ]);
  assert.deepEqual(groupTallies([{ world: "엘리시움", spent: 1 }]), [{ id: "regular", n: 1, spent: 1 }]);
  assert.deepEqual(groupTallies([]), []);
});

test("where a character was when a potential roll was made", () => {
  // 리프: star force in 챌린저스3 from day 10 to day 40, then in 엘리시움 from day 60. 붙박이 never left 스페셜.
  const day = (n: number) => n * 86_400_000;
  const runs = worldRuns([
    { t: day(40), who: "리프", world: "챌린저스3" },
    { t: day(10), who: "리프", world: "챌린저스3" },
    { t: day(60), who: "리프", world: "엘리시움" },
    { t: day(70), who: "리프", world: "엘리시움" },
    { t: day(20), who: "붙박이", world: "스페셜" },
    { t: day(30), who: "", world: "엘리시움" },
  ]);
  assert.deepEqual(runs.get("리프"), [
    { from: day(10), to: day(40), world: "챌린저스3" },
    { from: day(60), to: day(70), world: "엘리시움" },
  ]);
  const now = { 리프: "엘리시움", 붙박이: "스페셜", 조용이: "챌린저스3" };
  const at = (who: string, n: number) => worldAt(runs, now, who, day(n));
  // Before and during the seasonal tries: the seasonal world. Between the two runs and after: where it went.
  assert.deepEqual([5, 25, 40, 50, 65, 99].map((n) => at("리프", n)), ["챌린저스3", "챌린저스3", "챌린저스3", "엘리시움", "엘리시움", "엘리시움"]);
  assert.deepEqual([at("붙박이", 5), at("붙박이", 99)], ["스페셜", "스페셜"]);
  // No star force at all: where the character is now. Not in the account's list either: unknown.
  assert.deepEqual([at("조용이", 50), at("모르는이", 50)], ["챌린저스3", ""]);
  // After its last try with no word on where it is now: the world of that try.
  assert.equal(worldAt(runs, {}, "리프", day(99)), "엘리시움");
  assert.equal(worldAt(runs, {}, "constructor", day(1)), "");
});

test("character/list → character → world and id", () => {
  const body = {
    account_list: [
      { character_list: [{ ocid: "a1", character_name: "가", world_name: "엘리시움", character_level: 280 }, { character_name: "나", world_name: "스페셜" }] },
      { character_list: [{ character_name: "다" }, { world_name: "루나" }] },
    ],
  };
  assert.deepEqual(characterWorldsOf(body), { 가: "엘리시움", 나: "스페셜" });
  assert.deepEqual(characterWorldsOf({}), {});
  assert.deepEqual(characterIdsOf(body), { 가: "a1" });
});
