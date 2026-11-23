import { test } from "node:test";
import assert from "node:assert/strict";
import { evenMemberShare } from "../boss-split/boss-split-math.ts";
import { bossRows, cellsOf, lastWeekDate, monthlyThisWeek, crystalPrice, markKey, materialValue, partyFor, priceOf, rewardOf, share, untilReset, weekId, weekStart, withParty } from "./calc.ts";
import { BOXES, CRYSTAL, DROPS, ITEMS, MATERIALS, maxParty } from "./data.ts";

const kst = (iso: string) => Date.parse(`${iso}+09:00`);

test("the boss week starts on Thursday 00:00 KST", () => {
  // 2026-11-25 is a Wednesday, 11-26 a Thursday.
  assert.equal(weekId(kst("2026-11-25T23:59:00")), "2026-11-19");
  assert.equal(weekId(kst("2026-11-26T00:00:00")), "2026-11-26");
  assert.equal(weekStart(kst("2026-11-26T00:00:00")), kst("2026-11-26T00:00:00"));
  assert.deepEqual(untilReset(kst("2026-11-23T15:40:00")), { days: 2, hours: 8 });
  assert.deepEqual(untilReset(kst("2026-11-25T23:30:00")), { days: 0, hours: 0 });
});

test("scheduler rows: cleared or registered weekly and monthly bosses, in the scheduler's order", () => {
  const rows = bossRows({
    boss_contents: [
      { content_name: "자쿰", difficulty: "easy", cycle: "bossDaily", registration_flag: "true", complete_flag: "true", list_order_no: 1 },
      { content_name: "카링", difficulty: "hard", cycle: "bossWeekly", registration_flag: "true", complete_flag: "false", list_order_no: 30 },
      { content_name: "스우", difficulty: "extreme", cycle: "bossWeekly", registration_flag: "false", complete_flag: "true", list_order_no: 10 },
      { content_name: "윌", difficulty: "hard", cycle: "bossWeekly", registration_flag: "false", complete_flag: "false", list_order_no: 12 },
      { content_name: "검은 마법사", difficulty: "hard", cycle: "bossMonthly", registration_flag: "true", complete_flag: "true", list_order_no: 20 },
    ],
  });
  assert.deepEqual(
    rows.map((r) => [r.key, r.done, r.monthly]),
    [
      ["스우|익스트림", true, false],
      ["검은 마법사|하드", true, true],
      ["카링|하드", false, false],
    ]
  );
  assert.deepEqual(bossRows(null), []);
});

test("crystal prices of the confirmed screen and the missing ones", () => {
  assert.equal(crystalPrice("카링|하드"), 1_560_000_000);
  assert.equal(crystalPrice("림보|하드"), 2_385_000_000);
  // In-game shop list (2026-11-24): the gaps of the notices, and two rows the game has the other way round.
  assert.equal(crystalPrice("림보|익스트림"), 7_500_000_000);
  assert.equal(crystalPrice("발드릭스|익스트림"), 9_600_000_000);
  assert.equal(crystalPrice("벨로나|하드"), 2_950_000_000);
  assert.equal(crystalPrice("유피테르|하드"), 5_387_000_000);
  assert.equal(crystalPrice("카링|익스트림"), 4_845_000_000);
  assert.equal(crystalPrice("시즌 보스 메이린|노멀"), null);
  assert.equal(crystalPrice("핑크빈|카오스"), 1_320_000);
  assert.equal(crystalPrice("반 레온|하드"), 1_070_000);
  assert.equal(share(1_560_000_000, 3), 520_000_000);
  assert.equal(share(100_000_000, 3), 33_333_333);
});

test("party: set per difficulty, carried to the boss's other difficulties, solo when never set, capped", () => {
  let store = {};
  assert.equal(partyFor(store, "o1", "카링", "하드"), 1);
  store = withParty(store, "o1", "카링", "하드", 3);
  assert.equal(partyFor(store, "o1", "카링", "하드"), 3);
  assert.equal(partyFor(store, "o1", "카링", "익스트림"), 3, "last value of the boss");
  assert.equal(partyFor(store, "o2", "카링", "하드"), 1, "another character");
  store = withParty(store, "o1", "림보", "노멀", 6);
  assert.equal(partyFor(store, "o1", "림보", "노멀"), maxParty("림보"));
  assert.equal(maxParty("림보"), 3);
  assert.equal(maxParty("스우"), 6);
});

test("rewards: a box counts what came out, single items when checked, personal materials when switched on, drops split by party", () => {
  const key = "림보|하드";
  const marks = {
    [markKey("o1", key, "ring")]: "rr4",
    [markKey("o1", key, "pitch")]: "dream",
    [markKey("o1", key, "eter")]: true,
    [markKey("o1", key, "soul")]: "nope",
  } as const;
  const cells = cellsOf("o1", key, { ...marks });
  assert.deepEqual(cells.map((c) => c.kind), ["box", "item", "box", "item", "item", "item"]);
  const expected = priceOf("rr4", {}) + priceOf("dream", {}) + priceOf("eterDesire", {});
  assert.equal(rewardOf(cells, key, {}, false, 1, 3), evenMemberShare(expected, 1, 3));
  // 결정 2개 = 상자 0.2개 (15억 → 3억)
  assert.equal(materialValue(key, {}), 300_000_000);
  // Drops are shared like the split calculator; the personal material is not split and pays no fee.
  assert.equal(rewardOf(cells, key, {}, true, 3, 5), evenMemberShare(expected, 3, 5) + 300_000_000);
  // A price the user set wins.
  assert.equal(rewardOf(cells, key, { rr4: 400_000 }, false, 1, 3), evenMemberShare(expected - priceOf("rr4", {}) + 4_000_000_000, 1, 3));
  // A box answer that is not one of its options counts nothing.
  const wrong = cellsOf("o1", key, { [markKey("o1", key, "ring")]: "pain" })[0];
  assert.ok(wrong.kind === "box" && wrong.got === null);
});

test("defaults the user gave and the ones read from the expected-value calculator", () => {
  assert.equal(ITEMS.rr4.price, 330_000);
  assert.equal(ITEMS.ct4.price, 230_000);
  assert.equal(ITEMS.legacy.price, 6_700_000);
  assert.equal(ITEMS.dream.price, 340_000);
  assert.equal(ITEMS.sin.price, 35_000_000);
  assert.equal(ITEMS.eterDesire.price, 150_000);
  assert.equal(ITEMS.eterBeast.price, 1_000);
  assert.deepEqual(BOXES.ringLife.opts, ["rr4", "ct4", "lifeStone"]);
});

test("every boss · difficulty in the tables has a crystal price, and every material points at a box", () => {
  for (const key of Object.keys(DROPS)) assert.ok(key in CRYSTAL, key);
  for (const [key, m] of Object.entries(MATERIALS)) {
    assert.ok(key in CRYSTAL, key);
    assert.equal(ITEMS[m.box].cat, "eter");
  }
});

test("a boss cleared at one difficulty is not also left at another", () => {
  const rows = bossRows({
    boss_contents: [
      { content_name: "스우", difficulty: "normal", cycle: "bossWeekly", registration_flag: "true", complete_flag: "false", list_order_no: 1 },
      { content_name: "스우", difficulty: "hard", cycle: "bossWeekly", registration_flag: "false", complete_flag: "true", list_order_no: 1 },
      { content_name: "윌", difficulty: "hard", cycle: "bossWeekly", registration_flag: "true", complete_flag: "false", list_order_no: 2 },
    ],
  });
  assert.deepEqual(rows.map((r) => [r.key, r.done]), [["스우|하드", true], ["윌|하드", false]]);
});

test("a monthly clear counts only in the week it was made", () => {
  const cleared = { boss_contents: [{ content_name: "검은 마법사", difficulty: "hard", cycle: "bossMonthly", registration_flag: "true", complete_flag: "true" }] };
  const notYet = { boss_contents: [{ content_name: "검은 마법사", difficulty: "hard", cycle: "bossMonthly", registration_flag: "true", complete_flag: "false" }] };
  const mid = kst("2026-11-23T12:00:00"); // week of 11-19, the month began before it
  assert.equal(lastWeekDate(mid), "2026-11-18");
  assert.equal(monthlyThisWeek("검은 마법사", cleared, mid), false, "cleared last week");
  assert.equal(monthlyThisWeek("검은 마법사", notYet, mid), true, "cleared this week");
  assert.equal(monthlyThisWeek("검은 마법사", undefined, mid), null, "not known yet");
  // 2026-12-01 (Tue) is in the week of 11-26: the month began this week, so every clear is this week's.
  assert.equal(monthlyThisWeek("검은 마법사", cleared, kst("2026-12-01T12:00:00")), true);
});
