import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_HP_WEIGHTS, DEFAULT_XENON_WEIGHTS, armorChance, bestWeaponGrade, hpScore, hpTarget, weaponChance, tierValues, xenonChips } from "./flame.ts";
import { percentileOf } from "./luck.ts";
import { soulPlan } from "./soul.ts";

const near = (actual: number, expected: number, tolerance: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);

test("weapon flames match spec §4-8", () => {
  // 1추 + 0 %: 4/19 × 1 % → 475 eternal flames, 158 abyss flames on average.
  near(1 / weaponChance("eternal", 1, 0), 475, 1, "eternal 1추");
  near(1 / weaponChance("abyss", 1, 0), 158.3, 0.5, "abyss 1추");
  assert.equal(weaponChance("strong", 1, 0), 0);
  assert.equal(bestWeaponGrade("strong"), 2);
});

test("weapon %급 (boss + damage + all stat + main stat ÷ 10) matches a simulation", () => {
  // Seeded simulation of eternal flames on a Lv.200 boss weapon: 4 of 19 options, tier 3~7.
  let seed = 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const tiers = [0, 0.29, 0.45, 0.25, 0.01];
  const tier = () => {
    let r = rand();
    for (let i = 0; i < 5; i++) if ((r -= tiers[i]) < 0) return i + 3;
    return 7;
  };
  // 0 attack · 1 boss · 2 damage · 3 all stat · 4 main · 5..7 main pairs · 8..18 unrelated
  const N = 300_000;
  let hits = 0;
  for (let n = 0; n < N; n++) {
    const picks = new Set<number>();
    while (picks.size < 4) picks.add(Math.floor(rand() * 19));
    let atk = 0;
    let pct = 0;
    for (const o of picks) {
      const t = tier();
      if (o === 0) atk = t;
      else if (o === 1) pct += 2 * t;
      else if (o === 2 || o === 3) pct += t;
      else if (o === 4) pct += (t * 11) / 10;
      else if (o <= 7) pct += (t * 6) / 10;
    }
    if (atk >= 5 && pct >= 10) hits++;
  }
  const sim = hits / N;
  const exact = weaponChance("eternal", 3, 10, 200);
  assert.ok(Math.abs(sim - exact) / exact < 0.06, `sim ${sim} vs exact ${exact}`);
});

test("armor flames: harder targets are rarer, abyss beats eternal", () => {
  const e100 = armorChance("eternal", 200, 100);
  const e140 = armorChance("eternal", 200, 140);
  assert.ok(e100 > e140 && e140 > 0);
  assert.ok(armorChance("abyss", 200, 120) > armorChance("eternal", 200, 120));
  // Target 0 is always reached.
  near(armorChance("eternal", 200, 0), 1, 1e-9, "target 0");
  // Highest possible at Lv.200: four best options at tier 7 can never pass this.
  assert.equal(armorChance("abyss", 200, 1000), 0);
});

test("Xenon flames: STR · DEX · LUK all count, attack and all stat by their weights", () => {
  assert.ok(armorChance("eternal", 200, 300, "xenon") > armorChance("eternal", 200, 340, "xenon"));
  near(armorChance("eternal", 200, 0, "xenon"), 1, 1e-9, "target 0");
  // Best at Lv.200 with the default weights (the middle of three Xenons: all stat 1 % = 34.7): three
  // stat pairs at tier 7 (2 × 6 × 7 each) + all stat 7 % × 34.7 = 494.9.
  assert.deepEqual(DEFAULT_XENON_WEIGHTS, { attack: 6.28, allStat: 34.7 });
  assert.ok(armorChance("abyss", 200, 494.9, "xenon") > 0);
  assert.equal(armorChance("abyss", 200, 495, "xenon"), 0);
  // The weights are the user's to change: all stat worth more makes the same target easier.
  assert.ok(armorChance("eternal", 200, 340, "xenon", undefined, undefined, { attack: 6.28, allStat: 50 }) > armorChance("eternal", 200, 340, "xenon"));
});

test("Xenon goal chips follow the item level, each as hard to roll as its Lv.200 chip (user, 2026-11-14)", () => {
  assert.deepEqual(xenonChips(200), [260, 300, 340, 380]);
  assert.deepEqual(xenonChips(150), [230, 260, 290, 320]);
  assert.deepEqual(xenonChips(160), [240, 280, 310, 350]);
  assert.deepEqual(xenonChips(250), [270, 310, 350, 400]);
  const p = (level: number, x: number) => armorChance("eternal", level, x, "xenon");
  for (const level of [140, 160, 250]) {
    xenonChips(level).forEach((x, i) => {
      const want = p(200, [260, 300, 340, 380][i]);
      // At least as likely as the Lv.200 chip, and the next round 10 up is not.
      assert.ok(p(level, x) >= want && p(level, x + 10) < want, `Lv.${level} chip ${x}`);
    });
  }
  // Items too low for these goals still get four different chips.
  assert.equal(new Set(xenonChips(30)).size, 4);
});

test("tier values split real items' bonus stats (NEXON Open API, 2026-11-14)", () => {
  // Every flamed armor · accessory of seven characters (101 items, Lv.75 ~ 250) splits into four lines with these
  // values; at Lv.250 single 13 or double 6 instead leave most of them unsplittable. A few of them:
  const [l250, l200, l160] = [tierValues(250), tierValues(200), tierValues(160)];
  // Lv.250 shirt: DEX 5 + STR·DEX 5 + DEX·LUK 5 (+ all stat %) = STR 35 · DEX 130 · LUK 35.
  assert.deepEqual([5 * l250.double, 5 * l250.single + 10 * l250.double, 5 * l250.double], [35, 130, 35]);
  // Lv.250 pants: STR 5 + STR·LUK 6 + DEX·LUK 5 = STR 102 · DEX 35 · LUK 77.
  assert.deepEqual([5 * l250.single + 6 * l250.double, 5 * l250.double, 11 * l250.double], [102, 35, 77]);
  // Lv.200 belt: LUK 6 + STR·LUK 6 + DEX·LUK 6 = STR 36 · DEX 36 · LUK 138.
  assert.deepEqual([6 * l200.double, 6 * l200.double, 6 * l200.single + 12 * l200.double], [36, 36, 138]);
  // Lv.160 shoes: STR 6 + LUK 6 + STR·LUK 5 = STR 79 · LUK 79.
  assert.deepEqual([6 * l160.single + 5 * l160.double, 6 * l160.single + 5 * l160.double], [79, 79]);
});

test("soul ether averages", () => {
  const ether = [2.1, 3.4, 4.3, 30.4];
  const r = soulPlan(0, 4, 0, ether);
  near(r.avgTries, 57.0, 0.1, "0 → 4");
  const stages = r.stages.map((s) => Math.round(s.avgTries * 100) / 100);
  assert.deepEqual(stages, [9.18, 12.62, 16.14, 19.11]);
  // The distribution adds up to 1 and failures already made shorten the road.
  near(r.dist.reduce((s, x) => s + x, 0), 1, 1e-9, "dist sum");
  assert.ok(soulPlan(0, 1, 10, ether).avgTries < soulPlan(0, 1, 0, ether).avgTries);
  assert.ok(percentileOf(r.dist, 0.9) > percentileOf(r.dist, 0.1));
});

test("flame values per tier", () => {
  assert.deepEqual(tierValues(200), { single: 11, double: 6, hp: 600 });
  // Lv.250 counts as 220 for single stats; HP drops the ones digit.
  assert.deepEqual(tierValues(250), { single: 12, double: 7, hp: 700 });
  assert.equal(tierValues(135).hp, 390);
  // Max HP at 3추 · 2추 · 1추 (tiers 5 · 6 · 7), as players know them (user, 2026-11-13).
  const hp = (level: number) => [5, 6, 7].map((tier) => tierValues(level).hp * tier);
  assert.deepEqual(hp(160), [2400, 2880, 3360]);
  assert.deepEqual(hp(200), [3000, 3600, 4200]);
  assert.deepEqual(hp(250), [3500, 4200, 4900]);
});

test("Demon Avenger flames: the goal is HP n추 + 공 m, in max HP through the conversion", () => {
  // The default weights are one Lv.299 Demon Avenger's: its six Lv.250 armor flames (max HP 4,900 each; attack and
  // STR as below) come to these scores (user's character, 2026-11-13).
  assert.deepEqual(DEFAULT_HP_WEIGHTS, { attack: 67.8, str: 0.51 });
  const worn: [number, number, number][] = [[4, 0, 5171], [5, 0, 5239], [6, 0, 5307], [6, 35, 5325], [5, 35, 5257], [5, 0, 5239]];
  for (const [attack, str, score] of worn) assert.equal(Math.round(hpScore(4900, attack, str)), score);
  // 1추 + 공 5 at Lv.200 with attack 1 = HP 90: 4,200 + 450.
  assert.equal(hpTarget(200, 1, 5, { attack: 90, str: 1 }), 4650);
  assert.equal(hpTarget(160, 3, 0), 2400);
  assert.equal(hpTarget(250, 2, 0), 4200);
  // With attack and STR worth nothing only the HP line counts: one of the four out of 19 (4 ÷ 19) at tier 7,
  // 1 % with the reset and 3 % with the abyss flame; 3추 = tier 5 and up (71 % with the reset).
  const only = { attack: 0, str: 0 };
  near(armorChance("eternal", 200, hpTarget(200, 1, 0, only), "hp", undefined, only), (4 / 19) * 0.01, 1e-12, "eternal 1추");
  near(armorChance("abyss", 200, hpTarget(200, 1, 0, only), "hp", undefined, only), (4 / 19) * 0.03, 1e-12, "abyss 1추");
  near(armorChance("eternal", 200, hpTarget(200, 3, 0, only), "hp", undefined, only), (4 / 19) * 0.71, 1e-12, "eternal 3추");
  // The strong flame stops at tier 6: no 1추.
  assert.equal(armorChance("strong", 200, hpTarget(200, 1, 0, only), "hp", undefined, only), 0);
  // With only attack counted besides HP, "1추 + 공 5" needs both lines (C(17,2) ÷ C(19,4) = 2 ÷ 57): HP at tier 7
  // with attack 5 or more, or HP at tier 6 with attack… 600 short, which attack at 90 a point cannot make up (7 × 90).
  const atk = { attack: 90, str: 0 };
  near(armorChance("eternal", 200, hpTarget(200, 1, 5, atk), "hp", undefined, atk), (2 / 57) * (0.01 * 0.71 + 0.25 * 0), 1e-12, "1추 + 공 5");
  // A person's own numbers change the answer: attack worth more makes a lower HP line with high attack count too.
  const rich = { attack: 200, str: 0 };
  assert.ok(armorChance("eternal", 200, hpTarget(200, 1, 5, atk), "hp", undefined, rich) > armorChance("eternal", 200, hpTarget(200, 1, 5, atk), "hp", undefined, atk));
  // A weight with decimals: the goal and the roll it stands for land on the same 0.01 step (Codex review,
  // 2026-11-13: 1추 + 공 4 at attack 1 = HP 90.123 used to miss its own roll). Every tier of the reset has attack 4 up.
  const odd = { attack: 90.123, str: 0 };
  near(armorChance("eternal", 200, hpTarget(200, 1, 4, odd), "hp", undefined, odd), (2 / 57) * 0.01, 1e-12, "decimal weight");
  // STR lines count once STR is worth something.
  assert.ok(armorChance("eternal", 200, 4200, "hp", undefined, { attack: 90, str: 5 }) > armorChance("eternal", 200, 4200, "hp", undefined, { attack: 90, str: 0 }));
});
