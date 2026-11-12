import assert from "node:assert/strict";
import { test } from "node:test";
import { armorChance, bestWeaponGrade, weaponChance, tierValues } from "./flame.ts";
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
  assert.ok(armorChance("eternal", 250, 4500, "hp") > 0);
});

test("Xenon flames: STR · DEX · LUK all count, attack and all stat by their weights", () => {
  assert.ok(armorChance("eternal", 200, 350, "xenon") > armorChance("eternal", 200, 400, "xenon"));
  near(armorChance("eternal", 200, 0, "xenon"), 1, 1e-9, "target 0");
  // Best at Lv.200 with the default weights (maplescouter, 제논: all stat 1 % = 36.8): three stat pairs at tier 7
  // (2 × 6 × 7 each) + all stat 7 % × 36.8 = 509.6.
  assert.ok(armorChance("abyss", 200, 509, "xenon") > 0);
  assert.equal(armorChance("abyss", 200, 510, "xenon"), 0);
  // The weights are the user's to change: all stat worth more makes the same target easier.
  assert.ok(armorChance("eternal", 200, 350, "xenon", undefined, undefined, { attack: 7.28, allStat: 50 }) > armorChance("eternal", 200, 350, "xenon"));
});

test("soul ether averages match mapletiptip", () => {
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

test("flame values per tier follow the namu.wiki formulas", () => {
  assert.deepEqual(tierValues(200), { single: 11, double: 6, hp: 600 });
  // Lv.250 counts as 220 for single stats; HP drops the ones digit.
  assert.deepEqual(tierValues(250), { single: 12, double: 7, hp: 700 });
  assert.equal(tierValues(135).hp, 390);
});
