import assert from "node:assert/strict";
import { test } from "node:test";
import { averageTries } from "./luck.ts";
import { NO_CONV, OPTIONS, SOUL_EXTRA, addWeaponChance, customChance, emblemUseful, linesFirstChance, slotOptions, comboChance, practicalTargets, bestValues, convFromSpec, convFromText, convPct, fixFirstLine, gradeUp, lineTables, resetMeso, soulChance, statTargets, sumChance, weaponChance, type WeaponGoal, WEAPON_TIERS, weaponTierOf } from "./potential.ts";

const near = (actual: number, expected: number, tolerance: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);

const v3: WeaponGoal = { attack: "atk", ied: true, min: { a: 0, b: 0, i: 0, v: 3 }, tier: "v3" };

test("black cube legendary weapon line 1 matches the official table", () => {
  const rows = lineTables("black", "legendary", "weapon", 200)!;
  const boss35 = rows[0].find((r) => r[0] === "boss" && r[1] === 35)!;
  near(boss35[2], 0.097561, 1e-6, "boss 35 % on line 1");
});

test("weapon goals match the checked numbers (spec §4-8)", () => {
  const rows = lineTables("black", "legendary", "weapon", 200)!;
  near(weaponChance(rows, v3), 0.0141, 0.0002, "useful 3 lines");
  near(weaponChance(rows, { ...v3, ied: false }), 0.0042, 0.0001, "3 lines without ignore defense");
  near(weaponChance(rows, { ...v3, min: { a: 2, b: 0, i: 0, v: 2 } }), 0.0106, 0.0002, "2+ attack lines");
  near(weaponChance(rows, { ...v3, min: { a: 2, b: 1, i: 0, v: 3 } }), 0.0012, 0.0001, "2 attack + 1 boss");
  // Attack % sum ≥ 30 (12 · 9 · 9 or better) = 0.0219792 %.
  near(weaponChance(rows, { ...v3, min: { a: 3, b: 0, i: 0, v: 3 } }), 0.000219792, 0.000001, "attack 3 lines");
});

test("이탈 chips get harder in order: 반이탈 · 꽉이탈 1 · 2 · 3줄 (user's meanings, 2026-11-12)", () => {
  const rows = lineTables("black", "legendary", "weapon", 200)!;
  const tiers = WEAPON_TIERS.map((t) => weaponChance(rows, { ...v3, tier: t.id }));
  assert.deepEqual(WEAPON_TIERS.map((t) => t.label), ["유효 3줄", "반이탈", "꽉이탈 1줄", "꽉이탈 2줄", "꽉이탈 3줄"]);
  near(tiers[1], 0.00437, 0.00005, "반이탈: a line 2 · 3 of the item's grade");
  near(tiers[2], 0.00225, 0.00005, "꽉이탈 1줄: a line 2 · 3 at the top value");
  near(tiers[3], 0.001125, 0.000005, "꽉이탈 2줄: that, and line 1 at the top value");
  near(tiers[4], 0.0000313, 0.000001, "꽉이탈 3줄: all three at the top value");
  for (let i = 1; i < tiers.length; i++) assert.ok(tiers[i] < tiers[i - 1]);
});

test("이탈 chips go together with the line counts: 반이탈 + 보공 2줄 (user, 2026-11-14)", () => {
  const rows = lineTables("black", "legendary", "weapon", 200)!;
  const boss2 = { a: 0, b: 2, i: 0, v: 3 };
  const half = weaponChance(rows, { ...v3, tier: "half" });
  const boss = weaponChance(rows, { ...v3, min: boss2 });
  const both = weaponChance(rows, { ...v3, min: boss2, tier: "half" });
  assert.ok(both > 0 && both < half && both < boss, `${both} should be below 반이탈 ${half} and 보공 2줄 ${boss}`);
});

test("conversion fields: attack and all stat typed as main stat %, older flat numbers read the same (user, 2026-11-14)", () => {
  const d = { level: 296, v9: 6.31, cd3: 11.9, atk1: 2.29, all1: 11.6, cool1: 6.47 };
  const flat = convFromSpec(d);
  // Nothing typed (or the old flat fields only): the same conversion as before, the % shown worked out from them.
  assert.deepEqual(convFromText({}, d), flat);
  assert.deepEqual(convFromText({ atk1: "2.29", all1: "11.6" }, d), flat);
  const shown = convPct({}, d);
  near(shown.allPct, flat.all, 1e-12, "all stat 1 % in main stat %");
  near(shown.atkPct, flat.atkf, 1e-12, "attack 1 in main stat %");
  // A % typed wins over the flat number, and is not moved by the level.
  const typed = convFromText({ atkPct: "0.3", allPct: "1.2", level: "250" }, d);
  assert.deepEqual([typed.atkf, typed.all], [0.3, 1.2]);
  assert.equal(convFromText({ cool1: "8" }, d).cool, 8);
});

test("the tier of an option a weapon actually has", () => {
  const rows = lineTables("black", "legendary", "weapon", 250)!;
  const tier = (...lines: [string, number][]) => weaponTierOf(rows, "atk", lines.some(([c]) => c === "ied"), lines);
  // Lv.250 legendary: line 1 tops are 공 13 % · 보공 45 % · 방무 45 %; 40 % is the item's grade but not the top.
  assert.equal(tier(["atk", 13], ["boss", 35], ["boss", 35]), "v3");
  assert.equal(tier(["boss", 40], ["boss", 40], ["atk", 10]), "half");
  assert.equal(tier(["boss", 40], ["boss", 45], ["atk", 10]), "one");
  assert.equal(tier(["boss", 45], ["boss", 45], ["atk", 10]), "two");
  assert.equal(tier(["atk", 13], ["boss", 35], ["atk", 13]), "two");
  assert.equal(tier(["boss", 45], ["boss", 45], ["atk", 13]), "all");
  // A top value on a line that is not useful does not count; ignore defence counts only when it is asked for.
  assert.equal(weaponTierOf(rows, "atk", false, [["boss", 45], ["ied", 45], ["atk", 10]]), "v3");
  assert.equal(weaponTierOf(rows, "atk", true, [["boss", 45], ["ied", 45], ["atk", 10]]), "two");
  // The tiers are for three useful lines (user, 2026-11-15): a line that is not useful leaves the option without one,
  // however good the other two are.
  assert.equal(tier(["str", 13], ["boss", 45], ["atk", 10]), "v3");
  assert.equal(tier(["boss", 45], ["boss", 45], ["str", 13]), "v3");
  assert.equal(weaponTierOf(rows, "atk", false, [["boss", 45], ["boss", 45]]), "v3");
  // The option meets its own tier's rule, so its chance is never above a plain "three useful lines".
  for (const t of ["half", "one", "two", "all"] as const) assert.ok(weaponChance(rows, { ...v3, ied: false, tier: t }) < weaponChance(rows, { ...v3, ied: false }));
});

test("emblems: damage and the main stat are useful lines too (user, 2026-11-15)", () => {
  const rows = lineTables("black", "legendary", "emblem", 200)!;
  const goal = (main: "str" | "all" | "hp"): WeaponGoal => ({ ...v3, more: emblemUseful(main) });
  // Three useful lines = every line useful: the product of each line's share of 공 · 방무 · 데미지 · STR · 올스탯.
  const cats = new Set(["atk", "ied", "dmg", "str", "all"]);
  const share = rows.map((line) => line.filter((r) => cats.has(r[0])).reduce((sum, r) => sum + r[2], 0));
  near(weaponChance(rows, goal("str")), share[0] * share[1] * share[2], 1e-12, "three useful lines");
  // A demon avenger's emblem counts max HP % (no legendary emblem line has it) and not all stat; a Xenon's all stat only.
  assert.ok(weaponChance(rows, goal("hp")) < weaponChance(rows, goal("all")));
  assert.ok(weaponChance(rows, goal("all")) < weaponChance(rows, goal("str")));
  // Without them only attack % and ignore defence count, as before.
  assert.ok(weaponChance(rows, v3) < weaponChance(rows, goal("str")));
  // Tiers read those lines too: 공 12 · STR 12 (line 2, the item's grade) · 데미지 12 (line 3) are all at the top value.
  const tier = (...lines: [string, number][]) => weaponTierOf(rows, "atk", true, lines, emblemUseful("str"));
  assert.equal(tier(["atk", 12], ["str", 12], ["dmg", 12]), "all");
  assert.equal(tier(["atk", 12], ["atk", 12], ["str", 9]), "two");
  // DEX on a warrior's emblem is no useful line: two useful lines have no tier.
  assert.equal(tier(["atk", 12], ["atk", 12], ["dex", 9]), "v3");
  for (const t of ["half", "one", "two", "all"] as const) assert.ok(weaponChance(rows, { ...goal("str"), tier: t }) < weaponChance(rows, goal("str")));
});

test("lines first: more useful lines always count as better (user, 2026-11-15)", () => {
  const rows = lineTables("black", "legendary", "weapon", 200)!;
  const three = weaponChance(rows, { ...v3, ied: false });
  // 보공 40 + 40 and a line that is not useful: every three-line option, and two lines with 보공 80 % or more.
  const p = linesFirstChance(rows, ["atk", "boss"], 2, { boss: 80 });
  const useful = (c: string) => c === "atk" || c === "boss";
  let brute = 0;
  for (const a of rows[0])
    for (const b of rows[1])
      for (const c of rows[2]) {
        const xs = [a, b, c];
        const n = xs.filter((r) => useful(r[0])).length;
        const boss = xs.reduce((sum, r) => sum + (r[0] === "boss" ? r[1] : 0), 0);
        if (n === 3 || (n === 2 && boss >= 80)) brute += a[2] * b[2] * c[2];
      }
  // The official lines add up to a hair under 100 % (0.999996): the rest is "anything else" there, not here.
  near(p, brute, 1e-8, "counted line by line");
  // Never rarer than three useful lines; "+ @" and a higher total are rarer, a lower total is not.
  assert.ok(p > three);
  assert.ok(linesFirstChance(rows, ["atk", "boss"], 2, { boss: 80 }, ["dmg", "str", "all"]) < p);
  assert.ok(linesFirstChance(rows, ["atk", "boss"], 2, { boss: 60 }) > p);
  // One useful line: every option with two or three is better.
  assert.ok(linesFirstChance(rows, ["atk", "boss"], 1, { boss: 40 }) > weaponChance(rows, { ...v3, ied: false, min: { a: 0, b: 0, i: 0, v: 2 } }));
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

test("stat conversion: Lv.296 example turns flat lines into main stat %", () => {
  const c = convFromSpec({ level: 296, v9: 6.31, cd3: 11.9, atk1: 2.29, all1: 11.6 });
  // 2 x floor(296 / 9) = 64 flat main stat = 6.31 %, so 1 % = 10.14 flat.
  assert.ok(Math.abs(c.all - 11.6 / (64 / 6.31)) < 1e-9);
  assert.ok(Math.abs(c.atkf - 2.29 / (64 / 6.31)) < 1e-9);
  assert.equal(c.lvstr, 3.155);
  assert.ok(Math.abs(c.cd - 11.9 / 3) < 1e-9);
  // One point of a flat main stat line: 6.31 % ÷ 64.
  assert.ok(Math.abs(c.flat - 6.31 / 64) < 1e-12);
  assert.equal(NO_CONV.flat, 0);
  // A flat stat line counts through it: more ways to reach the same number than with that line worth nothing.
  const rows = lineTables("white", "legendary", "shoes", 200)!;
  const withFlat = sumChance(rows, { type: "stat", min: 10 - 1e-9, conv: c, attack: "atk" });
  const without = sumChance(rows, { type: "stat", min: 10 - 1e-9, conv: { ...c, flat: 0 }, attack: "atk" });
  assert.ok(withFlat > without && without > 0, `${withFlat} > ${without}`);
});

test("main stat goal with conversion only adds lines, never removes them", () => {
  const rows = lineTables("white", "legendary", "hat", 200)!;
  const conv = convFromSpec({ level: 296, v9: 6.31, cd3: 11.9, atk1: 2.29, all1: 11.6 });
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

test("meso reset cost by level band and grade", () => {
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
  // begchi shows 40.16 with independent lines; a "쓸만한" skill on line 2 cannot repeat on line 3 (official cap), so 40.12.
  near(1 / sumChance(top(gloves, "cd"), { type: "crit", lines: 2 }), 40.12, 0.01, "prime gloves 2 crit lines");
  const add = lineTables("white", "legendary", "weapon", 200)!;
  near(1 / addWeaponChance(add, "atk", "a21", true), 11.0, 0.05, "prime additional atk 21%");
  near(1 / addWeaponChance(add, "atk", "a3", true), 461.8, 0.1, "prime additional atk 30%");
});

test("soul +@ = all stat, main stat %, damage, boss (official table has damage 8% at 2.5641%)", () => {
  const soul = lineTables("soul", "legendary", "soul", 4)!;
  near(addWeaponChance(soul, "atk", "a21", false, SOUL_EXTRA), 0.004684, 0.000001, "soul atk 14%");
  near(addWeaponChance(soul, "atk", "a21x", false, SOUL_EXTRA), 0.000893, 0.000001, "soul atk 14% + @");
});

test("Xenon (all stat %) and Demon Avenger (HP %) use their own lines, values and chances", () => {
  const hat = lineTables("black", "legendary", "hat", 200)!;
  assert.equal(Math.max(...statTargets(hat, "str")), 36);
  assert.equal(Math.max(...statTargets(hat, "all")), 27, "all stat tops at 9 % per line");
  assert.equal(Math.max(...statTargets(hat, "hp")), 36);
  // Three top lines: all stat 9 % lines are rarer than STR 12 % lines.
  const str3 = sumChance(hat, { type: "stat", min: 36 });
  const all3 = sumChance(hat, { type: "stat", min: 27, main: "all" });
  assert.ok(all3 < str3, `all ${all3} < str ${str3}`);
  // Only the class's own line counts: STR lines do nothing for Xenon.
  assert.ok(sumChance(hat, { type: "stat", min: 12, main: "all" }) < sumChance(hat, { type: "stat", min: 12 }));
  // Additional potential: HP 11 % lines (5.0 %) are likelier than STR 8 % lines (3.3 %).
  const add = lineTables("white", "legendary", "hat", 200)!;
  assert.equal(Math.max(...statTargets(add, "hp")), 33);
  assert.ok(sumChance(add, { type: "stat", min: 11, main: "hp" }) > sumChance(add, { type: "stat", min: 8, conv: NO_CONV }));
});

test("gloves / hats: special-option lines + main stat lines, the rest any option (option B, 2026-11-10)", () => {
  const gloves = lineTables("black", "legendary", "gloves", 200)!;
  const g = (lines: number, stat: number) => comboChance(gloves, { type: "combo", special: "cd", lines, stat });
  // Lv.200 legendary black cube. A main stat line = a main stat % line or an all stat % line (user, 2026-11-12;
  // before that only the main stat's own line counted: 2.16 · 0.105 · 0.0235 %).
  // 12.24 · 3.715 until 2026-11-12: the options that cannot repeat (쓸만한 skills, 피격 시 데미지 % 무시) were not left
  // out of the later lines here, as they are for every other goal (Codex review).
  assert.equal(+(g(1, 0) * 100).toFixed(2), 12.26);
  assert.equal(+(g(1, 1) * 100).toFixed(3), 3.729);
  assert.equal(+(g(2, 0) * 100).toFixed(3), 0.258);
  assert.equal(+(g(1, 2) * 100).toFixed(3), 0.335);
  assert.equal(+(g(2, 1) * 100).toFixed(4), 0.0422);
  assert.equal(+(g(3, 0) * 100).toFixed(4), 0.001);
  // Xenon (all stat only) and demon avenger (HP only) count their own line, as before.
  const own = (main: "all" | "hp") => +(comboChance(gloves, { type: "combo", special: "cd", lines: 1, stat: 1, main }) * 100).toFixed(3);
  assert.deepEqual([own("all"), own("hp")], [1.727, 2.484]);
  // More lines asked → never easier.
  assert.ok(g(1, 0) > g(1, 1) && g(1, 1) > g(1, 2) && g(2, 0) > g(2, 1) && g(2, 1) > g(3, 0));
  // sumChance routes combo goals to comboChance.
  assert.equal(sumChance(gloves, { type: "combo", special: "cd", lines: 1, stat: 1 }), g(1, 1));
  // Hats: cooldown lines.
  const hat = lineTables("black", "legendary", "hat", 200)!;
  const h1 = comboChance(hat, { type: "combo", special: "cool", lines: 1, stat: 0 });
  const h11 = comboChance(hat, { type: "combo", special: "cool", lines: 1, stat: 1 });
  assert.ok(h1 > h11 && h11 > 0);
  // Prime cube keeps line 1 = crit damage → one crit line is certain.
  const primeRows = lineTables("prime", "legendary", "gloves", 200);
  if (primeRows) assert.equal(+comboChance(fixFirstLine(primeRows, "cd", bestValues([primeRows[0]]).cd ?? 0), { type: "combo", special: "cd", lines: 1, stat: 0 }).toFixed(6), 1);
  // A skill kept on line 1 cannot come again: lines 2 · 3 are rolled without the skills, so crit damage + main stat on
  // them is likelier than after a line that takes nothing away (Codex review: 0.4697 % against 0.4046 %).
  const one = { type: "combo" as const, special: "cd" as const, lines: 1, stat: 1 };
  const afterSkill = comboChance(fixFirstLine(gloves, "sksharp", 0), one);
  const afterPlain = comboChance(fixFirstLine(gloves, "", 0), one);
  assert.deepEqual([+(afterSkill * 100).toFixed(4), +(afterPlain * 100).toFixed(4)], [0.4697, 0.4046]);
  // The same for a hat: cooldown seconds in total + a main stat line after a kept skill.
  const sum = { type: "combo" as const, special: "cool" as const, lines: 1, stat: 1, minSum: 2 };
  assert.ok(comboChance(fixFirstLine(hat, "skbless", 0), sum) > comboChance(fixFirstLine(hat, "", 0), sum) * 1.05);
});

test("additional gloves: crit damage 1 % lines do not count (3 % only, user 2026-11-10)", () => {
  const add = lineTables("white", "legendary", "gloves", 200)!;
  const all = comboChance(add, { type: "combo", special: "cd", lines: 1, stat: 1 });
  const only3 = comboChance(add, { type: "combo", special: "cd", lines: 1, stat: 1, minSpecial: 3 });
  assert.equal(+(only3 * 100).toFixed(4), 0.5352);
  assert.ok(only3 < all);
  // Main potential has crit damage 8 % only: the threshold changes nothing there.
  const main = lineTables("black", "legendary", "gloves", 200)!;
  assert.equal(
    comboChance(main, { type: "combo", special: "cd", lines: 1, stat: 1, minSpecial: 3 }),
    comboChance(main, { type: "combo", special: "cd", lines: 1, stat: 1 }),
  );
});

test("target chips = realistic three-line sums, dense below the top (user, 2026-11-10)", () => {
  const conv = convFromSpec({ level: 296, v9: 6.31, cd3: 11.9, atk1: 2.29, all1: 11.6 });
  const black = lineTables("black", "legendary", "hat", 200)!;
  const white = lineTables("white", "legendary", "hat", 200)!;
  // Additional armor tops out at 8 + 6 + 6 = 20 (8 % on lines 2 · 3 is a 0.02 % line).
  assert.deepEqual(practicalTargets(white, { conv }, 2), [12, 14, 16, 18, 20]);
  // Main armor: 12 + 12 + 9 = 33 (line 3 at 12 % is 0.5 %, below the 1 % cut).
  assert.deepEqual(practicalTargets(black, { conv }, 3), [21, 24, 27, 30, 33]);
  // Additional HP (Demon Avenger): only HP lines count → 16 (8 + 8), 19 (11 + 8), 27 (11 + 8 + 8).
  assert.deepEqual(practicalTargets(white, { main: "hp" }, 2), [16, 19, 27]);
  // Gloves: crit damage 8 % converts to 31.7 % main stat, so the chips follow crit lines (efficiency).
  const gloves = lineTables("black", "legendary", "gloves", 200)!;
  const g = practicalTargets(gloves, { conv }, 3);
  assert.equal(g.at(-1), 72, "crit 8 + crit 8 + main stat 9");
  assert.ok(g.includes(63), "two crit lines");
  // Every chip has a real chance.
  for (const n of g) assert.ok(sumChance(gloves, { type: "stat", min: n, conv }) > 0);
});

test("custom goal: sums over the three lines, sets are alternatives", () => {
  const rows = lineTables("black", "legendary", "weapon", 200)!;
  // Same goal as "attack 3 lines" above (attack % total ≥ 30 = 0.0219792 %).
  near(customChance(rows, [[{ cat: "atk", min: 30 }]]), 0.000219792, 0.000001, "attack total 30");
  const bossAtk = customChance(rows, [[{ cat: "boss", min: 60 }, { cat: "atk", min: 9 }]]);
  const atkBoss = customChance(rows, [[{ cat: "boss", min: 30 }, { cat: "atk", min: 18 }]]);
  near(bossAtk, 0.001867, 0.000005, "boss 60 + attack 9");
  near(atkBoss, 0.00118, 0.000005, "boss 30 + attack 18");
  // The two sets cannot both happen in three lines, so "or" is the plain sum.
  near(customChance(rows, [[{ cat: "boss", min: 60 }, { cat: "atk", min: 9 }], [{ cat: "boss", min: 30 }, { cat: "atk", min: 18 }]]), bossAtk + atkBoss, 1e-9, "either set");
  assert.equal(customChance(rows, [[]]), 0);
  assert.equal(customChance(rows, [[], [{ cat: "atk", min: 30 }]]), customChance(rows, [[{ cat: "atk", min: 30 }]]));
  // An option the slot cannot roll never succeeds.
  assert.equal(customChance(rows, [[{ cat: "cool", min: 1 }]]), 0);
});

test("slot options: only what the slot can roll, with reachable totals", () => {
  const weapon = slotOptions(lineTables("black", "legendary", "weapon", 200)!);
  const cats = weapon.map((o) => o.cat);
  for (const c of ["boss", "ied", "atk", "matk", "dmg", "crit", "str", "all", "atkf"]) assert.ok(cats.includes(c), `weapon has ${c}`);
  for (const c of ["cool", "drop", "cd", "sksharp", "hp"]) assert.ok(!cats.includes(c), `weapon has no ${c}`);
  assert.deepEqual(weapon.find((o) => o.cat === "atk")!.sums, [9, 12, 18, 21, 24, 30, 33, 36]);
  assert.deepEqual(weapon.find((o) => o.cat === "boss")!.sums.slice(0, 4), [30, 35, 40, 60]);
  assert.ok(!slotOptions(lineTables("black", "legendary", "emblem", 200)!).some((o) => o.cat === "boss"), "emblems have no boss line");
  const hat = slotOptions(lineTables("black", "legendary", "hat", 200)!);
  assert.deepEqual(hat.find((o) => o.cat === "cool")!.sums, [1, 2, 3, 4, 5, 6]);
  // Capped options only offer totals that can happen: a "쓸만한" skill once, 피격 후 무적시간 once.
  assert.deepEqual(hat.find((o) => o.cat === "skdoor")!.sums, [1]);
  for (const slot of ["hat", "top", "gloves", "shoes", "bottom", "overall"])
    for (const o of slotOptions(lineTables("black", "legendary", slot, 200)!))
      for (const sum of o.sums) assert.ok(customChance(lineTables("black", "legendary", slot, 200)!, [[{ cat: o.cat, min: sum }]]) > 0, `${slot} ${o.cat} ${sum} can happen`);
  assert.ok(slotOptions(lineTables("black", "legendary", "gloves", 200)!).some((o) => o.cat === "sksharp"), "gloves can roll sharp eyes");
  // Every option in the data has a label.
  const known = new Set(OPTIONS.map((o) => o.cat));
  for (const cube of ["black", "gold", "silver", "white"] as const)
    for (const grade of ["unique", "legendary"] as const)
      for (const slot of ["weapon", "sub", "emblem", "hat", "top", "gloves", "shoes", "ring", "heart"]) {
        const rows = lineTables(cube, grade, slot, 200);
        for (const r of rows?.flat() ?? []) assert.ok(known.has(r[0]), `${cube} ${grade} ${slot}: ${r[0]} has no label`);
      }
});

test("custom goal: all stat % counts for the four stats, capped options are not repeated", () => {
  const pct = (cube: "black" | "white", grade: "unique" | "legendary", slot: string, level: number, sets: { cat: string; min: number }[][]) =>
    customChance(lineTables(cube, grade, slot, level)!, sets) * 100;
  // Numbers checked on 2026-11-11.
  near(pct("black", "legendary", "hat", 200, [[{ cat: "str", min: 33 }]]), 0.0240677431, 0.00001, "hat STR 33");
  near(pct("black", "legendary", "earring", 200, [[{ cat: "str", min: 27 }]]), 0.5669008935, 0.0001, "earring STR 27");
  near(pct("black", "unique", "top", 200, [[{ cat: "str", min: 21 }]]), 0.1679482535, 0.0001, "unique top STR 21");
  near(pct("white", "legendary", "hat", 200, [[{ cat: "str", min: 14 }]]), 0.2973221735, 0.0001, "additional hat STR 14");
  near(pct("black", "legendary", "gloves", 200, [[{ cat: "cd", min: 8 }, { cat: "str", min: 21 }]]), 0.04857156, 0.00002, "gloves crit damage + STR 21");
  // Line caps ("쓸만한" skills once): the later lines are scaled up.
  near(pct("black", "legendary", "hat", 200, [[{ cat: "cool", min: 4 }]]), 0.0625234153, 0.00002, "hat cooldown 4");
  near(pct("black", "legendary", "gloves", 200, [[{ cat: "cd", min: 16 }]]), 0.258399003, 0.00005, "gloves crit damage 16");
  // Max HP % is not raised by all stat %.
  near(pct("black", "legendary", "top", 250, [[{ cat: "hp", min: 36 }]]), 0.024492953, 0.00001, "top HP 36");
  // A "쓸만한" skill cannot come twice.
  assert.equal(pct("black", "legendary", "gloves", 200, [[{ cat: "sksharp", min: 2 }]]), 0);
  const hat = slotOptions(lineTables("black", "legendary", "hat", 200)!);
  assert.equal(hat.find((o) => o.cat === "str")!.base, 9);
  assert.ok(hat.find((o) => o.cat === "str")!.sums.includes(15), "STR 9 + all stat 6");
});

test("soul tables keep decimal values (증폭 1 · 3단계: 공격력 +1.5 % · +4.5 %), checked 2026-11-11", () => {
  for (const stage of [1, 2, 3, 4]) {
    const rows = lineTables("soul", "legendary", "soul", stage)!;
    near(addWeaponChance(rows, "atk", "a21", false, SOUL_EXTRA), 0.004684, 0.000001, `stage ${stage} attack goal`);
    near(addWeaponChance(rows, "atk", "a3", false, SOUL_EXTRA), 0.000111, 0.000001, `stage ${stage} attack 3 lines`);
  }
  assert.ok(lineTables("soul", "legendary", "soul", 3)!.flat().some((r) => r[0] === "atk" && r[1] === 4.5), "stage 3 has attack 4.5 %");
  assert.ok(lineTables("soul", "legendary", "soul", 1)!.flat().some((r) => r[0] === "atk" && r[1] === 1.5), "stage 1 has attack 1.5 %");
});
