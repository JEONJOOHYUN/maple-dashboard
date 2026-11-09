import assert from "node:assert/strict";
import { test } from "node:test";
import { averageTries } from "./luck.ts";
import { NO_CONV, SOUL_EXTRA, addWeaponChance, bestValues, convFromScouter, fixFirstLine, gradeUp, lineTables, resetMeso, soulChance, statTargets, sumChance, weaponChance, type WeaponGoal } from "./potential.ts";

const near = (actual: number, expected: number, tolerance: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);

const v3: WeaponGoal = { attack: "atk", ied: true, min: { a: 0, b: 0, i: 0, v: 3 }, tier: "v3" };

test("black cube legendary weapon line 1 matches the official table", () => {
  const rows = lineTables("black", "legendary", "weapon", 200)!;
  const boss35 = rows[0].find((r) => r[0] === "boss" && r[1] === 35)!;
  near(boss35[2], 0.097561, 1e-6, "boss 35 % on line 1");
});

test("weapon goals match the numbers checked against mesu.live (spec §4-8)", () => {
  const rows = lineTables("black", "legendary", "weapon", 200)!;
  near(weaponChance(rows, v3), 0.0141, 0.0002, "useful 3 lines");
  near(weaponChance(rows, { ...v3, ied: false }), 0.0042, 0.0001, "3 lines without ignore defense");
  near(weaponChance(rows, { ...v3, min: { a: 2, b: 0, i: 0, v: 2 } }), 0.0106, 0.0002, "2+ attack lines");
  near(weaponChance(rows, { ...v3, min: { a: 2, b: 1, i: 0, v: 3 } }), 0.0012, 0.0001, "2 attack + 1 boss");
  // Attack % sum ≥ 30 (12 · 9 · 9 or better) = 0.0219792 % on mesu.live.
  near(weaponChance(rows, { ...v3, min: { a: 3, b: 0, i: 0, v: 3 } }), 0.000219792, 0.000001, "attack 3 lines");
});

test("이탈 chips get harder in order (spec §4-8)", () => {
  const rows = lineTables("black", "legendary", "weapon", 200)!;
  const tiers = (["v3", "half", "one", "two", "all"] as const).map((tier) => weaponChance(rows, { ...v3, tier }));
  near(tiers[1], 0.00437, 0.00005, "반이탈");
  near(tiers[2], 0.00225, 0.00005, "이탈 1줄");
  near(tiers[3], 0.0000627, 0.000001, "이탈 2줄");
  near(tiers[4], 0.0000313, 0.000001, "올이탈");
  for (let i = 1; i < tiers.length; i++) assert.ok(tiers[i] < tiers[i - 1]);
});

test("armor main stat targets follow the item level", () => {
  assert.deepEqual(statTargets(lineTables("black", "legendary", "top", 200)!), [27, 30, 33, 36]);
  assert.deepEqual(statTargets(lineTables("black", "legendary", "top", 250)!), [30, 33, 36, 39]);
  const p30 = sumChance(lineTables("black", "legendary", "top", 200)!, { type: "stat", min: 30 });
  const p33 = sumChance(lineTables("black", "legendary", "top", 200)!, { type: "stat", min: 33 });
  assert.ok(p30 > p33 && p33 > 0);
});

test("cubes without a table or grade return nothing", () => {
  assert.equal(lineTables("bronze", "legendary", "top", 200), null);
  assert.equal(lineTables("silver", "legendary", "top", 200), null);
  assert.ok(lineTables("silver", "unique", "top", 200));
  // Emblem has no Lv.250 table, falls back to the lower one.
  assert.ok(lineTables("black", "legendary", "emblem", 250));
});

test("grade-up with a guarantee and soul lines", () => {
  // Black cube unique → legendary: 1.4 %, guaranteed at 107.
  near(averageTries(0.014, 107), (1 - 0.986 ** 107) / 0.014, 1e-9, "guarantee");
  assert.ok(averageTries(0.014, 107) < 1 / 0.014);
  near(soulChance("legendary", 3), 0.004975 ** 2, 1e-12, "soul 3 lines");
});

test("additional weapon: 공 21%, 21% + @, 3 lines", async () => {
  const { addWeaponChance, addWeaponNeed } = await import("./potential.ts");
  const rows = lineTables("white", "legendary", "weapon", 200)!;
  assert.equal(addWeaponNeed(rows, "atk"), 21);
  const a21 = addWeaponChance(rows, "atk", "a21");
  const a21x = addWeaponChance(rows, "atk", "a21x");
  const a3 = addWeaponChance(rows, "atk", "a3");
  assert.ok(a21 > a21x && a21x > a3 && a3 > 0);
  // Line 1 attack 12 % = 5.1282 %, then a 9 % (4.628 %) or 12 % (0.02551 %) on line 2 or 3.
  const p1 = 0.051282;
  const q9 = 0.04628 + 0.0002551;
  const lowerBound = p1 * (1 - (1 - q9) ** 2);
  assert.ok(a21 >= lowerBound * 0.99, `${a21} vs ≥ ${lowerBound}`);
});

test("soul: official option tables by amplification stage", async () => {
  const { addWeaponChance } = await import("./potential.ts");
  const rows = lineTables("soul", "legendary", "soul", 4)!;
  assert.ok(rows);
  // Line 1 attack +8 % = 5.1282 % (official 2026-11-08).
  near(rows[0].find((r) => r[0] === "atk" && r[1] === 8)![2], 0.051282, 1e-6, "soul atk 8%");
  const a = addWeaponChance(rows, "atk", "a21");
  const ax = addWeaponChance(rows, "atk", "a21x");
  assert.ok(a > ax && ax > 0);
  assert.ok(lineTables("soul", "rare", "soul", 1));
});

test("maplescouter conversion: Lv.296 example turns flat lines into main stat %", () => {
  const c = convFromScouter({ level: 296, v9: 6.31, cd3: 11.9, atk1: 2.29, all1: 11.6 });
  // 2 x floor(296 / 9) = 64 flat main stat = 6.31 %, so 1 % = 10.14 flat.
  assert.ok(Math.abs(c.all - 11.6 / (64 / 6.31)) < 1e-9);
  assert.ok(Math.abs(c.atkf - 2.29 / (64 / 6.31)) < 1e-9);
  assert.equal(c.lvstr, 3.155);
  assert.ok(Math.abs(c.cd - 11.9 / 3) < 1e-9);
});

test("main stat goal with conversion only adds lines, never removes them", () => {
  const rows = lineTables("white", "legendary", "hat", 200)!;
  const conv = convFromScouter({ level: 296, v9: 6.31, cd3: 11.9, atk1: 2.29, all1: 11.6 });
  const plain = sumChance(rows, { type: "stat", min: 18 });
  const withConv = sumChance(rows, { type: "stat", min: 18, conv, attack: "atk" });
  assert.ok(withConv > plain);
  // Without conversion the old rule holds: main stat % + all stat % 1:1.
  assert.equal(sumChance(rows, { type: "stat", min: 18, conv: NO_CONV }), plain);
});

test("additional reset: meso reset and white cube share one entry, grade-up differs", () => {
  // Guarantee: after N failures the next try goes up, so the sure try is N + 1.
  assert.deepEqual(gradeUp("white", "rare", false), { p: 0.02381, cap: 63 });
  assert.deepEqual(gradeUp("white", "rare", false, true), { p: 0.047619, cap: 32 });
  assert.deepEqual(gradeUp("white", "unique", false, true), { p: 0.007, cap: 215 });
});

test("meso reset cost by level band and grade (namu.wiki table)", () => {
  assert.equal(resetMeso("black", "legendary", 200), 45_000_000);
  assert.equal(resetMeso("black", "rare", 250), 5_000_000);
  assert.equal(resetMeso("white", "unique", 160), 70_550_000);
  assert.equal(resetMeso("white", "legendary", 150), 78_000_000);
  assert.equal(resetMeso("soul", "legendary", 0), 88_000_000);
  // Cash cubes have no meso price.
  assert.equal(resetMeso("gold", "legendary", 200), null);
  // Ceiling totals on the same page: black rare 10 × 450만 = 0.45억 (Lv.200~249).
  assert.equal(10 * resetMeso("black", "rare", 220)!, 45_000_000);
});

test("prime cubes keep line 1: matches maple.begchi.com and the dcinside post", () => {
  const top = (rows: ReturnType<typeof lineTables>, cat: string) => fixFirstLine(rows!, cat, bestValues([rows![0]])[cat]);
  const w = lineTables("black", "legendary", "weapon", 200)!;
  const atkBoss: WeaponGoal = { attack: "atk", ied: false, min: { a: 0, b: 0, i: 0, v: 3 }, tier: "v3" };
  near(1 / weaponChance(w, atkBoss), 239.04, 0.01, "black weapon atk/boss 3 lines");
  near(1 / weaponChance(w, atkBoss, "a"), 46.64, 0.01, "prime weapon atk/boss 3 lines");
  const em = lineTables("black", "legendary", "emblem", 200)!;
  const atk3: WeaponGoal = { attack: "atk", ied: false, min: { a: 3, b: 0, i: 0, v: 3 }, tier: "v3" };
  near(1 / weaponChance(em, atk3, "a"), 188.91, 0.01, "prime emblem atk 30%");
  const heart = lineTables("black", "legendary", "heart", 200)!;
  near(1 / sumChance(top(heart, "str"), { type: "stat", min: 30 }), 42.72, 0.01, "prime heart 30%");
  const gloves = lineTables("black", "legendary", "gloves", 200)!;
  near(1 / sumChance(top(gloves, "cd"), { type: "crit", lines: 2 }), 40.16, 0.01, "prime gloves 2 crit lines");
  const add = lineTables("white", "legendary", "weapon", 200)!;
  near(1 / addWeaponChance(add, "atk", "a21", true), 11.0, 0.05, "prime additional atk 21%");
  near(1 / addWeaponChance(add, "atk", "a3", true), 461.8, 0.1, "prime additional atk 30%");
});

test("soul +@ = all stat, main stat %, damage, boss (official table has damage 8% at 2.5641%)", () => {
  const soul = lineTables("soul", "legendary", "soul", 4)!;
  near(addWeaponChance(soul, "atk", "a21", false, SOUL_EXTRA), 0.004684, 0.000001, "soul atk 14%");
  near(addWeaponChance(soul, "atk", "a21x", false, SOUL_EXTRA), 0.000893, 0.000001, "soul atk 14% + @");
});
