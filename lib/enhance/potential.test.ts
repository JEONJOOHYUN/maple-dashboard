import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_CONV, SOUL_EXTRA, addWeaponChance, addWeaponSumChance, convFromSpec, customChance, fixFirstLine, lineTables, resetMeso, sumChance, weaponChance } from "../ev/potential.ts";
import { STAT_CONV_DEFAULT } from "../ev/defaults.ts";
import { buildPotStats, potEntries } from "./pot-stats.ts";
import { cappedCategory, cubeFee, cubeOf, feeByInsight, gearJob, goalChance, goalOf, gradeBefore, kindOf, potKey, optionToken, parsePotential, pricedCube, rollMeso, rollsToUp, slotOf, statRule, statRules, statWorth, trackPieces, upChance, upRolls, type PotRow, type RawPotential } from "./potential.ts";

const near = (actual: number, expected: number, tolerance: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);

// The shape the API returned on 2026-11-12 (values made up).
const opt = (...values: string[]) => values.map((value) => ({ value, grade: "레전드리" }));
let seq = 0;
const raw = (over: Partial<RawPotential> = {}): RawPotential => ({
  id: `p${seq++}`,
  character_name: "테스트",
  date_create: "2026-11-08T20:21:09.207+09:00",
  potential_type: "잠재능력 재설정",
  item_upgrade_result: "실패",
  miracle_time_flag: "이벤트 적용되지 않음",
  item_equipment_part: "신발",
  item_level: 250,
  target_item: "에테르넬 메이지슈즈",
  potential_option_grade: "레전드리",
  additional_potential_option_grade: "노멀",
  upgrade_guarantee: false,
  upgrade_guarantee_count: 0,
  before_potential_option: opt("올스탯 +10%", "INT +10%", "최대 HP +10%"),
  before_additional_potential_option: [],
  after_potential_option: opt("INT +13%", "INT +13%", "최대 MP +10%"),
  after_additional_potential_option: [],
  ...over,
});
const row = (over: Partial<RawPotential> = {}): PotRow => parsePotential(raw(over))!;

test("parse: meso reset, additional potential, cash cube and the grade before a grade-up", () => {
  const a = row();
  assert.deepEqual([a.meso, a.add, a.grade, a.up, a.part, a.level, a.before[1], a.after[0]], [true, false, "legendary", false, "신발", 250, "INT +10%", "INT +13%"]);
  const up = row({ item_upgrade_result: "성공", potential_option_grade: "유니크" });
  assert.deepEqual([up.up, up.grade, gradeBefore(up)], [true, "unique", "epic"]);
  const add = row({
    potential_type: "에디셔널 잠재능력 재설정",
    additional_potential_option_grade: "에픽",
    before_potential_option: opt("INT +13%"),
    after_potential_option: opt("INT +13%"),
    before_additional_potential_option: opt("마력 +10"),
    after_additional_potential_option: opt("마력 +11"),
  });
  assert.deepEqual([add.add, add.grade, add.before, add.after, cubeOf(add)], [true, "epic", ["마력 +10"], ["마력 +11"], "white"]);
  const cube = row({ potential_type: undefined, cube_type: "카르마 블랙 큐브" });
  assert.deepEqual([cube.meso, cube.type, cubeOf(cube)], [false, "카르마 블랙 큐브", "black"]);
  assert.equal(parsePotential({ id: "x" }), null);
});

test("price of a roll: the grade the item had when it was paid for", () => {
  assert.equal(rollMeso(row()), resetMeso("black", "legendary", 250));
  assert.equal(rollMeso(row({ item_upgrade_result: "성공", potential_option_grade: "유니크" })), resetMeso("black", "epic", 250));
});

test("a cube takes a fee by item level and the character's 통찰력", () => {
  const levels = [250, 200, 160, 121, 120, 71, 70, 31, 30, 0];
  const fees = (insight?: number) => levels.map((level) => cubeFee(level, insight));
  // Lv.121 and up: 20 L² whatever the 통찰력. Below: 2.5 L² (Lv.71~120) · 0.25 L² (Lv.31~70) · free to Lv.30.
  assert.deepEqual(fees(0), [1_250_000, 800_000, 512_000, 292_820, 36_000, 12_602, 1_225, 240, 0, 0]);
  assert.deepEqual(fees(59), fees(0));
  // 통찰력 60: items up to Lv.70 are free. 통찰력 90: up to Lv.120.
  assert.deepEqual(fees(60), [1_250_000, 800_000, 512_000, 292_820, 36_000, 12_602, 0, 0, 0, 0]);
  assert.deepEqual(fees(89), fees(60));
  assert.deepEqual(fees(90), [1_250_000, 800_000, 512_000, 292_820, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(fees(100), fees(90));
  // Not known: counted as waived.
  assert.deepEqual(fees(), fees(100));
  const cube = (over: Partial<RawPotential> = {}) => row({ potential_type: undefined, cube_type: "카르마 블랙 큐브", ...over });
  // Whatever the cube and the grade: the fee only looks at the level.
  assert.equal(rollMeso(cube()), 1_250_000);
  assert.equal(rollMeso(cube({ cube_type: "메멘토 브론즈 에디셔널 큐브 (200제)", item_level: 160 })), 512_000);
  assert.equal(rollMeso(cube({ item_upgrade_result: "성공", potential_option_grade: "유니크", item_level: 200 })), 800_000);
  // Not a cube (an item that sets the potential) and an unknown level: nothing.
  assert.equal(rollMeso(cube({ cube_type: "펄스 인핸서", item_level: 130 })), 0);
  assert.equal(rollMeso(cube({ item_level: undefined })), 0);
  assert.equal(rollMeso(cube({ item_level: 120 })), 0);
  assert.deepEqual([rollMeso(cube({ item_level: 120 }), 30), rollMeso(cube({ item_level: 120 }), 90), rollMeso(cube(), 0)], [36_000, 0, 1_250_000]);
  assert.deepEqual([cube({ item_level: 120 }), cube({ item_level: 121 }), cube({ item_level: 30 }), row({ item_level: 100 }), cube({ cube_type: "펄스 인핸서", item_level: 100 })].map(feeByInsight), [true, false, false, false, false]);
  // Per character: the one whose 통찰력 is known and low pays, the others do not.
  const low = cube({ item_level: 100, character_name: "부캐" });
  const high = cube({ item_level: 100, character_name: "본캐" });
  const unknown = cube({ item_level: 100, character_name: "모름" });
  const rolls = [low, high, unknown];
  assert.deepEqual(potEntries(rolls, trackPieces(rolls), { 부캐: 0, 본캐: 100 }).map((e) => e.cost), [25_000, 0, 0]);
  assert.deepEqual(potEntries(rolls, trackPieces(rolls)).map((e) => e.cost), [0, 0, 0]);
});

test("option lines map to the calculator's categories", () => {
  assert.deepEqual(optionToken("INT +13%"), ["int", 13]);
  assert.deepEqual(optionToken("INT +13"), ["fint", 13]);
  assert.deepEqual(optionToken("올스탯 +10%"), ["all", 10]);
  assert.deepEqual(optionToken("마력 +12"), ["matkf", 12]);
  assert.deepEqual(optionToken("보스 몬스터 데미지 +35%"), ["boss", 35]);
  assert.deepEqual(optionToken("몬스터 방어율 무시 +30%"), ["ied", 30]);
  assert.deepEqual(optionToken("캐릭터 기준 9레벨 당 INT +1"), ["lvint", 1]);
  assert.equal(optionToken("HP 회복 아이템 및 회복 스킬 효율 +30%"), null);
  assert.deepEqual([slotOf("신발"), slotOf("포스실드소울링"), slotOf("처음 보는 부위")], ["shoes", "sub", null]);
});

test("goal: main stat with all stat, the rest of the option left out", () => {
  assert.equal(goalOf(["INT +13%", "올스탯 +7%", "STR +10%"], false)!.label, "INT 20%");
  assert.equal(goalOf(["올스탯 +9%", "올스탯 +9%", "LUK +9%"], false)!.label, "LUK 27%");
  // A mage's item: magic attack counts, attack does not.
  assert.equal(goalOf(["INT +9%", "마력 +15", "공격력 +15"], true)!.label, "INT 9% · 마력 + 15");
  assert.equal(goalOf(["보스 몬스터 데미지 +35%", "공격력 +9%", "몬스터 방어율 무시 +30%"], false)!.label, "보공 35% · 방무 30% · 공격력 9%");
  // HP % only stands in when there is no stat line.
  assert.equal(goalOf(["LUK +12%", "최대 HP +9%", "DEX +9%"], false)!.label, "LUK 12%");
  assert.equal(goalOf(["최대 HP +9%", "방어력 +7%", "이동속도 +9"], false)!.label, "HP 9%");
  assert.equal(goalOf(["방어력 +7%", "이동속도 +9", "점프력 +9"], false), null);
});

test("armour: the goal is the option's worth in main stat %", () => {
  const goal = goalOf(["INT +13%", "INT +13%", "최대 MP +10%"], false)!;
  const hit = goalChance(row(), "legendary", goal, NO_CONV)!;
  assert.equal(hit.by, "INT 26%");
  // About 1 in 121 at Lv.250 legendary shoes (the calculator's table).
  near(1 / hit.p, 120.7, 0.5, "INT 26%");
  assert.equal(goalChance(row({ item_equipment_part: "처음 보는 부위" }), "legendary", goal, NO_CONV), null);
  const conv = convFromSpec(STAT_CONV_DEFAULT);
  // Main potential shows the plain % (all stat one for one); its average is the calculator's for that number.
  const main = goalChance(row(), "legendary", goalOf(["INT +13%", "INT +10%", "올스탯 +7%"], false)!, conv)!;
  assert.equal(main.by, "INT 30%");
  near(1 / main.p, 238.4, 0.5, "INT 30%");
  const shoes27 = goalChance(row(), "legendary", goalOf(["올스탯 +10%", "INT +10%", "올스탯 +7%"], false)!, conv)!;
  assert.equal(shoes27.by, "INT 27%");
  // 기댓값 계산기: 신발 Lv.250 레전드리 27 % = 평균 167회.
  near(1 / shoes27.p, 166.5, 0.5, "INT 27%");
  // A mixed additional option becomes one number: INT 9 % + magic attack 30 → "INT 15.8 %급" with the default conversion.
  const cape = goalOf(["INT +9%", "마력 +15", "마력 +15"], true)!;
  near(statWorth(cape, conv), 9 + 30 * conv.atkf, 1e-9, "worth");
  const add = row({ potential_type: "에디셔널 잠재능력 재설정", item_equipment_part: "망토", additional_potential_option_grade: "레전드리" });
  const mixed = goalChance(add, "legendary", cape, conv)!;
  assert.match(mixed.by, /^INT \d+(\.\d)?%급$/);
  // Any option worth that much counts, so it is far more likely than three magic attack lines alone.
  const three = goalChance(add, "legendary", goalOf(["마력 +15", "마력 +15", "마력 +15"], true)!, NO_CONV)!;
  assert.ok(mixed.p > 0 && three.p > 0);
});

// Every special part is judged by the calculator's own goal, so the two pages give the same average.
const COOL2 = "모든 스킬의 재사용 대기시간 -2초(10초 이하는 10%감소, 5초 미만으로 감소 불가)";
const COOL1 = "모든 스킬의 재사용 대기시간 -1초(10초 이하는 5%감소, 5초 미만으로 감소 불가)";
const ADD = { potential_type: "에디셔널 잠재능력 재설정", additional_potential_option_grade: "레전드리" };

test("weapons, secondaries and emblems: useful lines, as on the calculator", () => {
  const v = (n: number, ied: boolean) => ({ attack: "atk" as const, ied, min: { a: 0, b: 0, i: 0, v: n }, tier: "v3" as const });
  // 보공 + 공 + 방무 is three useful lines, not "the hardest single line" (that called it a 1-in-18 result).
  const shield = goalChance(row({ item_equipment_part: "방패", item_level: 200 }), "legendary", goalOf(["보스 몬스터 데미지 +35%", "공격력 +12%", "몬스터 방어율 무시 +30%"], false)!, NO_CONV)!;
  // 공 12 % on line 2 is a line at the top value: 꽉이탈 1줄, rarer than plain three useful lines.
  assert.equal(shield.by, "유효 3줄 · 꽉이탈 1줄");
  assert.equal(shield.p, weaponChance(lineTables("black", "legendary", "sub", 200)!, { ...v(3, true), tier: "one" }));
  const plain = goalChance(row({ item_equipment_part: "방패", item_level: 200 }), "legendary", goalOf(["보스 몬스터 데미지 +40%", "공격력 +9%", "몬스터 방어율 무시 +30%"], false)!, NO_CONV)!;
  assert.deepEqual([plain.by, plain.p], ["유효 3줄", weaponChance(lineTables("black", "legendary", "sub", 200)!, v(3, true))]);
  assert.ok(shield.p < plain.p);
  // No ignore defence line in the option: only attack % and boss damage count.
  const weapon = goalChance(row({ item_equipment_part: "무기", item_level: 200 }), "legendary", goalOf(["보스 몬스터 데미지 +40%", "보스 몬스터 데미지 +30%", "공격력 +9%"], false)!, NO_CONV)!;
  assert.equal(weapon.by, "공 · 보공 3줄");
  // 기댓값 계산기: 무기 Lv.200 레전드리, 방무 빼고 유효 3줄 = 평균 239회.
  near(1 / weapon.p, 239.04, 0.01, "공 · 보공 3줄");
  const emblem = goalChance(row({ item_equipment_part: "엠블렘", item_level: 200 }), "legendary", goalOf(["마력 +12%", "INT +9%", "마력 +9%"], false)!, NO_CONV)!;
  assert.equal(emblem.by, "마력 2줄");
  assert.equal(emblem.p, weaponChance(lineTables("black", "legendary", "emblem", 200)!, { ...v(2, false), attack: "matk" }));
  // The attack % lines decide 공격력 or 마력 on a weapon, not a stray stat line (마력 2줄 + STR is still 마력 2줄).
  const stray = goalChance(row({ item_equipment_part: "무기", item_level: 200 }), "legendary", goalOf(["마력 +12%", "마력 +9%", "STR +9%"], false)!, NO_CONV)!;
  assert.equal(stray.by, "마 · 보공 2줄");
  assert.equal(stray.p, weaponChance(lineTables("black", "legendary", "weapon", 200)!, { ...v(2, false), attack: "matk" }));
  // A weapon option with no useful line falls back to its hardest single total.
  assert.equal(goalChance(row({ item_equipment_part: "방패", item_level: 200 }), "legendary", goalOf(["데미지 +12%", "DEX +9%", "올스탯 +6%"], false)!, NO_CONV)!.by, "데미지 12%");
});

test("weapons, additional potential: the attack % it adds up to, with @ (user, 2026-11-13)", () => {
  const sub = row({ ...ADD, item_equipment_part: "포스실드소울링", item_level: 200 });
  const rows = lineTables("white", "legendary", "sub", 200)!;
  const a21 = goalChance(sub, "legendary", goalOf(["공격력 +12%", "공격력 +9%", "최대 HP +8%"], true)!, NO_CONV)!;
  assert.deepEqual([a21.by, a21.p], ["공격력 21%", addWeaponChance(rows, "atk", "a21")]);
  const a21x = goalChance(sub, "legendary", goalOf(["마력 +12%", "마력 +9%", "INT +9%"], true)!, NO_CONV)!;
  assert.deepEqual([a21x.by, a21x.p], ["마력 21% + @", addWeaponChance(rows, "matk", "a21x")]);
  const a3 = goalChance(sub, "legendary", goalOf(["마력 +12%", "마력 +9%", "마력 +9%"], true)!, NO_CONV)!;
  // Three lines are read by their total too: 12 + 9 + 9 is the least three lines can be, so it is the same as "3줄".
  assert.deepEqual([a3.by, a3.p], ["마력 30%", addWeaponSumChance(rows, "matk", 30)]);
  near(a3.p, addWeaponChance(rows, "matk", "a3"), 1e-15, "30 % = three lines");
  assert.ok(a3.p < a21x.p && a21x.p < a21.p);
  // 12 + 12 is not 12 + 9: 24 % is far rarer than 21 %, and 12 + 12 + 9 rarer than any three lines.
  const a24 = goalChance(sub, "legendary", goalOf(["공격력 +12%", "공격력 +12%", "최대 HP +8%"], true)!, NO_CONV)!;
  assert.deepEqual([a24.by, a24.p], ["공격력 24%", addWeaponSumChance(rows, "atk", 24)]);
  assert.ok(a24.p < a21.p / 10);
  const a33 = goalChance(sub, "legendary", goalOf(["마력 +12%", "마력 +12%", "마력 +9%"], true)!, NO_CONV)!;
  assert.equal(a33.by, "마력 33%");
  assert.ok(a33.p < a3.p / 10);
  // 공격력 12 % + 9 % with an INT line is still 공격력 21 % (it was read as "INT 9 %", about 4 rolls).
  const warrior = goalChance(row({ ...ADD, item_equipment_part: "무기", item_level: 200 }), "legendary", goalOf(["공격력 +12%", "공격력 +9%", "INT +9%"], true)!, NO_CONV)!;
  assert.deepEqual([warrior.by, warrior.p], ["공격력 21% + @", addWeaponChance(lineTables("white", "legendary", "weapon", 200)!, "atk", "a21x")]);
  assert.ok(1 / warrior.p > 213);
});

test("gloves with crit damage and hats with cooldown: the special option plus the main stat % in total (user, 2026-11-13)", () => {
  const gloves = row({ item_equipment_part: "장갑", item_level: 200 });
  const gRows = lineTables("black", "legendary", "gloves", 200)!;
  const cc = goalChance(gloves, "legendary", goalOf(["크리티컬 데미지 +8%", "크리티컬 데미지 +8%", "INT +12%"], false)!, NO_CONV)!;
  assert.deepEqual([cc.by, cc.p], ["크뎀 2줄 + INT 12%", customChance(gRows, [[{ cat: "cd", min: 16 }, { cat: "int", min: 12 }]])]);
  // The value of the stat line counts: INT 9 % next to the same two crit lines is a lesser option, and likelier.
  const cc9 = goalChance(gloves, "legendary", goalOf(["크리티컬 데미지 +8%", "크리티컬 데미지 +8%", "INT +9%"], false)!, NO_CONV)!;
  assert.equal(cc9.by, "크뎀 2줄 + INT 9%");
  assert.ok(cc.p < cc9.p / 5);
  // Counting lines put both at "크뎀 2줄 + 주스탯 1줄" (what the chips of the calculator still ask for).
  const byLines = sumChance(gRows, { type: "combo", special: "cd", lines: 2, stat: 1, minSpecial: 3 });
  assert.ok(cc.p < byLines && cc9.p < byLines);
  // All stat % raises the main stat too: it is part of the total.
  const withAll = goalChance(gloves, "legendary", goalOf(["크리티컬 데미지 +8%", "INT +9%", "올스탯 +6%"], false)!, NO_CONV)!;
  assert.deepEqual([withAll.by, withAll.p], ["크뎀 1줄 + INT 15%", customChance(gRows, [[{ cat: "cd", min: 8 }, { cat: "int", min: 15 }]])]);
  // Only all stat lines: an all-stat item (a Xenon item). A main stat line does not count for it — so it is rarer
  // than the same total on a main stat item.
  const allOnly = goalOf(["크리티컬 데미지 +8%", "올스탯 +9%", "올스탯 +6%"], false)!;
  const onlyAll = goalChance(gloves, "legendary", goalOf(["크리티컬 데미지 +8%", "올스탯 +9%", "올스탯 +6%"], false, { xenon: true })!, NO_CONV)!;
  // Anyone else: all stat is main stat, so a main stat line counts toward the same 15 % (user, 2026-11-13).
  const asMain = goalChance(gloves, "legendary", allOnly, NO_CONV)!;
  assert.deepEqual([asMain.by, asMain.p], ["크뎀 1줄 + 주스탯 15%", customChance(gRows, [[{ cat: "cd", min: 8 }, { cat: "str", min: 15 }]])]);
  assert.ok(onlyAll.p < asMain.p);
  assert.equal(onlyAll.by, "크뎀 1줄 + 올스탯 15%");
  near(onlyAll.p, customChance(gRows, [[{ cat: "cd", min: 8 }, { cat: "all", min: 15 }]]), 1e-12, "크뎀 1줄 + 올스탯 15%");
  assert.ok(onlyAll.p < withAll.p);
  const hatAll = goalChance(row({ item_equipment_part: "모자", item_level: 200 }), "legendary", goalOf([COOL1, "올스탯 +9%", "올스탯 +6%"], false, { xenon: true })!, NO_CONV)!;
  assert.equal(hatAll.by, "쿨감 1초 + 올스탯 15%");
  near(hatAll.p, customChance(lineTables("black", "legendary", "hat", 200)!, [[{ cat: "cool", min: 1 }, { cat: "all", min: 15 }]]), 1e-12, "쿨감 1초 + 올스탯 15%");
  const c = goalChance(gloves, "legendary", goalOf(["크리티컬 데미지 +8%", "방어력 +7%", "이동속도 +9"], false)!, NO_CONV)!;
  assert.equal(c.by, "크뎀 1줄");
  near(c.p, sumChance(gRows, { type: "combo", special: "cd", lines: 1, stat: 0, minSpecial: 3 }), 1e-12, "크뎀 1줄, as on the calculator");
  // Gloves without a crit damage line are plain armour.
  assert.equal(goalChance(gloves, "legendary", goalOf(["INT +12%", "INT +9%", "INT +9%"], false)!, NO_CONV)!.by, "INT 30%");

  const hat = row({ item_equipment_part: "모자", item_level: 200 });
  const hRows = lineTables("black", "legendary", "hat", 200)!;
  const four = goalChance(hat, "legendary", goalOf([COOL2, COOL2, "방어력 +7%"], false)!, NO_CONV)!;
  assert.equal(four.by, "쿨감 4초");
  near(four.p, sumChance(hRows, { type: "cool", min: 4 }), 1e-12, "쿨감 4초, as on the calculator");
  const mixed = goalChance(hat, "legendary", goalOf([COOL2, "INT +12%", "INT +9%"], false)!, NO_CONV)!;
  assert.deepEqual([mixed.by, mixed.p], ["쿨감 2초 + INT 21%", customChance(hRows, [[{ cat: "cool", min: 2 }, { cat: "int", min: 21 }]])]);
  // Two stat lines of any value ("쿨감 2초 + 주스탯 2줄") include 9 + 9: 21 % is rarer.
  assert.ok(mixed.p < sumChance(hRows, { type: "combo", special: "cool", lines: 1, stat: 2, minSum: 2 }));
  // Cooldown on two lines is read by its total: −2초 · −1초 = 3 seconds, −2초 · −2초 = 4 seconds.
  const three = goalChance(hat, "legendary", goalOf([COOL2, COOL1, "INT +12%"], false)!, NO_CONV)!;
  assert.deepEqual([three.by, three.p], ["쿨감 3초 + INT 12%", customChance(hRows, [[{ cat: "cool", min: 3 }, { cat: "int", min: 12 }]])]);
  const fourStat = goalChance(hat, "legendary", goalOf([COOL2, COOL2, "INT +12%"], false)!, NO_CONV)!;
  assert.deepEqual([fourStat.by, fourStat.p], ["쿨감 4초 + INT 12%", customChance(hRows, [[{ cat: "cool", min: 4 }, { cat: "int", min: 12 }]])]);
  // 3 seconds or more leaves out −1초 · −1초, which "two cooldown lines" let through; 4 seconds is harder still.
  const twoLines = sumChance(hRows, { type: "combo", special: "cool", lines: 2, stat: 1, minSpecial: 1 });
  assert.ok(fourStat.p < three.p && three.p < twoLines);
  // 3 seconds with INT 12 % = −2초 · −1초 either way round, or −2초 · −2초, with an INT 12 % line as the third
  // (one line cannot be 12 % any other way: all stat stops at 9 %).
  const p = (cat: string, value: number, i: number) => hRows[i].filter((r) => r[0] === cat && r[1] === value).reduce((s, r) => s + r[2], 0);
  const stat = (i: number) => p("int", 12, i);
  let byHand = 0;
  for (const s of [0, 1, 2]) {
    const [a, b] = [0, 1, 2].filter((i) => i !== s);
    byHand += stat(s) * (p("cool", 2, a) * p("cool", 1, b) + p("cool", 1, a) * p("cool", 2, b) + p("cool", 2, a) * p("cool", 2, b));
  }
  near(three.p, byHand, 1e-12, "쿨감 3초 + INT 12 %, by hand");
});

test("accessories: drop rate and meso lines count together, next to the stat", () => {
  const ring = row({ item_equipment_part: "반지", item_level: 160 });
  const rows = lineTables("black", "legendary", "ring", 160)!;
  const hit = goalChance(ring, "legendary", goalOf(["아이템 드롭률 +20%", "메소 획득량 +20%", "INT +9%"], false)!, NO_CONV)!;
  assert.deepEqual([hit.by, hit.p], ["드메 2줄", sumChance(rows, { type: "drop", lines: 2 })]);
});

test("converted number: shown rounded down, and the chance is of the number shown", () => {
  const conv = convFromSpec(STAT_CONV_DEFAULT);
  // 기계심장 에디셔널 유니크: INT 6 % + 마력 11 + 올스탯 2 % = 10.77 % with the default conversion.
  const heart = row({ ...ADD, additional_potential_option_grade: "유니크", item_equipment_part: "기계심장", item_level: 200 });
  const goal = goalOf(["INT +6%", "마력 +11", "올스탯 +2%"], true)!;
  near(statWorth(goal, conv), 10.771, 0.001, "worth");
  const hit = goalChance(heart, "unique", goal, conv)!;
  // "10.8 %급" with the average of 10.77 was one number here while the calculator gave another for 10.8.
  assert.equal(hit.by, "INT 10.7%급");
  assert.equal(hit.p, sumChance(lineTables("white", "unique", "heart", 200)!, { type: "stat", min: 10.7 - 1e-9, conv, attack: "matk" }));
  // Flat stat lines ("INT +12") count toward the number too (user, 2026-11-13): 789.2 rolls before they did.
  near(1 / hit.p, 602.5, 0.1, "INT 10.7%급");
  // The option's own flat stat line is in its worth: 64 flat = 6.31 % at Lv.296, so INT +12 is 1.18 %.
  const flat = goalOf(["INT +6%", "INT +12", "마력 +11"], true)!;
  near(statWorth(flat, conv), 6 + 12 * (6.31 / 64) + 11 * conv.atkf, 1e-9, "worth with a flat stat line");
  assert.ok(statWorth(flat, conv) > statWorth(goalOf(["INT +6%", "DEX +12", "마력 +11"], true)!, conv), "another stat's flat line is worth nothing");
  // Main potential is read plain: no conversion, so a flat line adds nothing there.
  assert.equal(statWorth(flat, NO_CONV), 6);
});

test("additional potential: a flat stat line names the stat when nothing else does (Codex review, 2026-11-13)", () => {
  const conv = convFromSpec(STAT_CONV_DEFAULT);
  const heart = row({ ...ADD, additional_potential_option_grade: "유니크", item_equipment_part: "기계심장", item_level: 200 });
  // STR +18 · 올스탯 2 % · 공격력 11: no STR % line, and still a STR option — the same number as on the calculator.
  const goal = goalOf(["STR +18", "올스탯 +2%", "공격력 +11"], true)!;
  assert.equal(goal.stat, "str");
  const worth = 18 * conv.flat + 2 * conv.all + 11 * conv.atkf;
  near(statWorth(goal, conv), worth, 1e-9, "worth");
  const shown = Math.floor(worth * 10 + 1e-6) / 10;
  const hit = goalChance(heart, "unique", goal, conv)!;
  assert.equal(hit.by, `STR ${shown}%급`);
  assert.equal(hit.p, sumChance(lineTables("white", "unique", "heart", 200)!, { type: "stat", min: shown - 1e-9, conv, attack: "atk" }));
  // The flat line alone, with nothing else worth a thing.
  const only = goalOf(["STR +18", "방어력 +120", "이동속도 +6"], true)!;
  assert.equal(only.stat, "str");
  const alone = goalChance(heart, "unique", only, conv)!;
  const shownAlone = Math.floor(18 * conv.flat * 10 + 1e-6) / 10;
  assert.equal(alone.by, `STR ${shownAlone}%급`);
  assert.equal(alone.p, sumChance(lineTables("white", "unique", "heart", 200)!, { type: "stat", min: shownAlone - 1e-9, conv, attack: "atk" }));
  // A stat % line still decides before a flat line of another stat does.
  assert.equal(goalOf(["INT +6%", "STR +18", "마력 +11"], true)!.stat, "int");
  // Main potential is read plain (no conversion): a flat line names nothing there.
  assert.equal(goalOf(["STR +12", "방어력 +120", "이동속도 +6"], false), null);
  // HP % on a warrior's piece (or one of no job) stays an HP option: the flat STR line next to it does not take
  // it over. On a mage's piece HP % is no goal, so there the flat line of its own stat is what is left.
  const warrior = { stats: ["str"] as const };
  for (const rule of [warrior, {}]) {
    const hp = goalOf(["최대 HP +11%", "STR +18", "최대 MP +8%"], true, rule)!;
    assert.deepEqual([hp.stat, hp.conds], ["", [{ cat: "hp", min: 11 }]]);
  }
  assert.equal(goalOf(["최대 HP +11%", "INT +18", "최대 MP +8%"], true, { stats: ["int"] })!.stat, "int");
});

test("average rolls to go up a grade include the guarantee", () => {
  near(upRolls(row(), "epic")!, 22.4, 0.1, "epic → unique");
  near(upRolls(row(), "unique")!, 55.8, 0.1, "unique → legendary");
  assert.equal(upRolls(row(), "legendary"), null);
  // Miracle time doubles the chance of a roll made in it (3.5 % → 7 %); the guarantee stays at the 43rd try.
  // "이벤트 적용중" is what the API said on 2026-08-02, a miracle time Sunday.
  const miracle = row({ miracle_time_flag: "이벤트 적용중" });
  assert.equal(miracle.mt, true);
  assert.deepEqual(upChance(miracle, "epic"), { p: 0.07, cap: 43 });
  assert.deepEqual(upChance(row(), "epic"), { p: 0.035, cap: 43 });
  near(upRolls(miracle, "epic")!, (1 - 0.93 ** 43) / 0.07, 1e-9, "epic → unique, miracle time");
  near(upRolls(miracle, "epic")!, 13.7, 0.1, "epic → unique, miracle time");
});

test("cubes: prime cubes are their own kind, judged with line 1 kept (the calculator's prime cube)", () => {
  const prime = row({ potential_type: undefined, cube_type: "프라임 에디셔널 큐브", additional_potential_option_grade: "레전드리", before_potential_option: [], after_potential_option: [], before_additional_potential_option: opt("마력 +12%"), after_additional_potential_option: opt("마력 +12%"), item_equipment_part: "무기", item_level: 200 });
  assert.deepEqual([prime.add, cubeOf(prime)], [true, "primeAddi"]);
  assert.equal(cubeOf(row({ potential_type: undefined, cube_type: "프라임 큐브" })), "prime");
  // 마력 12 % stays on line 1: three attack lines = the other two both attack %, as the calculator works it out.
  const kept = goalChance(prime, "legendary", goalOf(["마력 +12%", "마력 +9%", "마력 +9%"], true)!, NO_CONV)!;
  assert.equal(kept.by, "마력 30%");
  near(kept.p, addWeaponChance(lineTables("primeAddi", "legendary", "weapon", 200)!, "matk", "a3", true), 1e-15, "prime, three attack lines");
  assert.equal(upChance(prime, "unique"), null);
});

test("stats: a grade-up stretch is judged at the average chance of its rolls (miracle time, mixed cubes)", () => {
  const at = (n: number) => `2026-11-08T22:00:${String(n).padStart(2, "0")}.000+09:00`;
  const junk = opt("방어력 +7%", "이동속도 +9", "점프력 +9");
  const on = "이벤트 적용중";
  // Ten rolls at epic, five of them in miracle time; the tenth goes up.
  const list: PotRow[] = [];
  for (let i = 0; i < 9; i++) list.push(row({ potential_option_grade: "에픽", before_potential_option: junk, after_potential_option: junk, date_create: at(i), ...(i < 5 ? { miracle_time_flag: on } : {}) }));
  list.push(row({ potential_option_grade: "유니크", item_upgrade_result: "성공", before_potential_option: junk, after_potential_option: junk, date_create: at(9) }));
  const piece = buildPotStats(potEntries(list, trackPieces(list)), NO_CONV).pieces[0];
  assert.deepEqual([piece.phases[0].grade, piece.phases[0].rolls, piece.phases[0].up], ["epic", 10, true]);
  // Five rolls at 7 % and five at 3.5 % = 5.25 % a roll on average.
  near(piece.phases[0].expected!, rollsToUp(0.0525, 43), 1e-9, "half miracle time");
  assert.ok(piece.phases[0].expected! < upRolls(list[9], "epic")! && piece.phases[0].expected! > upRolls(list[0], "epic")!);
  // Every roll in miracle time = exactly double the chance.
  const all: PotRow[] = [];
  for (let i = 0; i < 9; i++) all.push(row({ potential_option_grade: "에픽", before_potential_option: junk, after_potential_option: junk, date_create: at(40 + i), miracle_time_flag: on }));
  all.push(row({ potential_option_grade: "유니크", item_upgrade_result: "성공", before_potential_option: junk, after_potential_option: junk, date_create: at(49), miracle_time_flag: on }));
  near(buildPotStats(potEntries(all, trackPieces(all)), NO_CONV).pieces[0].phases[0].expected!, rollsToUp(0.07, 43), 1e-9, "all miracle time");

  // Nine gold cubes, then a meso reset that goes up: not all judged as gold cubes, and no shared guarantee.
  const gold = { potential_type: undefined, cube_type: "명장의 큐브" };
  const mixed: PotRow[] = [];
  for (let i = 0; i < 9; i++) mixed.push(row({ ...gold, potential_option_grade: "에픽", before_potential_option: junk, after_potential_option: junk, date_create: at(20 + i) }));
  mixed.push(row({ potential_option_grade: "유니크", item_upgrade_result: "성공", before_potential_option: junk, after_potential_option: junk, date_create: at(29) }));
  const both = buildPotStats(potEntries(mixed, trackPieces(mixed)), NO_CONV).pieces[0];
  const goldChance = upChance(mixed[0], "epic")!.p;
  near(both.phases[0].expected!, 1 / ((9 * goldChance + 0.035) / 10), 1e-9, "mixed cubes");
  assert.ok(both.phases[0].expected! < 1 / goldChance);
});

test("pieces: a batch keeps the old option or takes one of its results; anything else is another item", () => {
  const A = opt("올스탯 +10%", "INT +10%", "최대 HP +10%");
  const B = opt("INT +13%", "INT +13%", "최대 MP +10%");
  const C = opt("방어력 +7%", "이동속도 +9", "점프력 +9");
  const D = opt("LUK +9%", "LUK +9%", "LUK +9%");
  const at = (n: number) => `2026-11-08T20:21:${String(n).padStart(2, "0")}.000+09:00`;
  const roll = (before: ReturnType<typeof opt>, after: ReturnType<typeof opt>, n: number) => row({ before_potential_option: before, after_potential_option: after, date_create: at(n) });
  const list = [
    // batch 1 from A: three results, none taken
    roll(A, C, 1), roll(A, C, 1), roll(A, D, 1),
    // batch 2 from A again: B is on the table
    roll(A, C, 2), roll(A, B, 2), roll(A, C, 2),
    // next roll starts from B → the second roll of batch 2 was taken
    roll(B, C, 3),
    // a roll starting from D fits nothing (batch 1 is long gone) → a second item
    roll(D, C, 4),
  ];
  const { piece, taken } = trackPieces(list);
  assert.deepEqual(list.map((r) => piece.get(r.id)), [1, 1, 1, 1, 1, 1, 1, 2]);
  assert.deepEqual([...taken], [list[4].id]);
});

test("stats: phases, expected cost and profit of one piece", () => {
  const at = (n: number) => `2026-11-08T20:${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}.000+09:00`;
  const junk = opt("방어력 +7%", "이동속도 +9", "점프력 +9");
  const good = opt("INT +13%", "INT +13%", "최대 MP +10%");
  const list: PotRow[] = [];
  // 10 rolls at unique, the 10th goes up; then 20 rolls at legendary, the last one shows INT 26 %.
  for (let i = 0; i < 9; i++) list.push(row({ potential_option_grade: "유니크", before_potential_option: junk, after_potential_option: junk, date_create: at(i) }));
  list.push(row({ potential_option_grade: "레전드리", item_upgrade_result: "성공", before_potential_option: junk, after_potential_option: junk, date_create: at(9) }));
  for (let i = 0; i < 19; i++) list.push(row({ before_potential_option: junk, after_potential_option: junk, date_create: at(10 + i) }));
  list.push(row({ before_potential_option: junk, after_potential_option: good, date_create: at(29) }));
  const stats = buildPotStats(potEntries(list, trackPieces(list)), NO_CONV);
  assert.equal(stats.pieces.length, 1);
  const p = stats.pieces[0];
  assert.deepEqual([p.rolls, p.resets, p.ups, p.from, p.grade, p.goalBy], [30, 30, 1, "unique", "legendary", "INT 26%"]);
  assert.deepEqual(p.phases.map((f) => [f.grade, f.rolls, f.up]), [["unique", 10, true], ["legendary", 20, false]]);
  const uniquePrice = resetMeso("black", "unique", 250)!;
  const legendPrice = resetMeso("black", "legendary", 250)!;
  assert.equal(p.spent, 10 * uniquePrice + 20 * legendPrice);
  near(p.expected!, upRolls(list[0], "unique")! * uniquePrice + p.goalRolls! * legendPrice, 1, "expected");
  near(p.delta!, p.expected! - p.spent, 1e-6, "profit");
  assert.deepEqual([stats.rolls, stats.cubes, stats.priced], [30, 0, 1]);
  near(stats.delta, p.delta!, 1e-6, "total");
});

test("stats: an option the item already had is not counted as won", () => {
  const at = (n: number) => `2026-11-08T21:00:${String(n).padStart(2, "0")}.000+09:00`;
  const junk = opt("방어력 +7%", "이동속도 +9", "점프력 +9");
  const good = opt("INT +13%", "INT +13%", "최대 MP +10%");
  // Ten rolls from an item that already had INT 26 %; nothing better came up, so it was kept.
  const kept: PotRow[] = [];
  for (let i = 0; i < 10; i++) kept.push(row({ before_potential_option: good, after_potential_option: junk, date_create: at(i) }));
  const a = buildPotStats(potEntries(kept, trackPieces(kept)), NO_CONV).pieces[0];
  // No bar for it, and the meso that changed nothing is a loss (user, 2026-11-13: it used to be left out).
  assert.deepEqual([a.option, a.goalBy, a.goalRolls, a.expected, a.delta], [["INT +13%", "INT +13%", "최대 MP +10%"], "", null, 0, -a.spent]);
  const whole = buildPotStats(potEntries(kept, trackPieces(kept)), NO_CONV);
  assert.deepEqual([whole.priced, whole.delta], [1, -a.spent]);
  // The option it already had: INT 26 % or better, as the calculator counts it, for reading only.
  assert.equal(a.keptBy, "INT 26%");
  near(a.keptRolls!, 1 / sumChance(lineTables("black", "legendary", "shoes", 250)!, { type: "stat", min: 26 - 1e-9, conv: NO_CONV, attack: "matk" }), 1e-6, "kept average");
  near(a.keptMeso!, a.keptRolls! * resetMeso("black", "legendary", 250)!, 1, "kept meso");
  assert.equal(a.phases[0].expected, null);
  assert.ok(a.spent > 0);
  // The same option, but one of these rolls produced it: it was won here, and the later rolls did not beat it.
  const won: PotRow[] = [row({ before_potential_option: junk, after_potential_option: good, date_create: at(20) })];
  for (let i = 1; i < 10; i++) won.push(row({ before_potential_option: good, after_potential_option: junk, date_create: at(20 + i) }));
  const b = buildPotStats(potEntries(won, trackPieces(won)), NO_CONV).pieces[0];
  assert.equal(b.goalBy, "INT 26%");
  assert.ok(b.goalRolls !== null && b.delta !== null);
});

test("stats: a better option of the same class as the old one counts as won (real rolls, 2026-09-30)", () => {
  // 데스티니 데스페라도, 카르마 블랙 큐브: every roll started from 공 13 + 보공 35 · 35, the last batch offered
  // 보공 45 · 45 + 공 10: lines 1 and 2 at the top value = 꽉이탈 2줄, far rarer than the old three useful lines.
  const weapon = { potential_type: undefined, cube_type: "카르마 블랙 큐브", item_equipment_part: "무기", target_item: "데스티니 데스페라도" };
  const old = opt("공격력 +13%", "보스 몬스터 데미지 +35%", "보스 몬스터 데미지 +35%");
  const better = opt("보스 몬스터 데미지 +45%", "보스 몬스터 데미지 +45%", "공격력 +10%");
  const at = (n: number) => `2026-10-01T03:06:${String(n).padStart(2, "0")}.000+09:00`;
  const rolls = [
    row({ ...weapon, before_potential_option: old, after_potential_option: opt("LUK +13%", "STR +10%", "INT +10%"), date_create: at(23) }),
    row({ ...weapon, before_potential_option: old, after_potential_option: opt("LUK +13%", "INT +10%", "보스 몬스터 데미지 +35%"), date_create: at(25) }),
    row({ ...weapon, before_potential_option: old, after_potential_option: better, date_create: at(25) }),
    row({ ...weapon, before_potential_option: old, after_potential_option: opt("LUK +13%", "DEX +10%", "크리티컬 확률 +10%"), date_create: at(25) }),
  ];
  const a = buildPotStats(potEntries(rolls, trackPieces(rolls)), NO_CONV).pieces[0];
  assert.deepEqual([a.option, a.goalBy], [better.map((o) => o.value), "공 · 보공 3줄 · 꽉이탈 2줄"]);
  const table = lineTables("black", "legendary", "weapon", 250)!;
  const three = { attack: "atk" as const, ied: false, min: { a: 0, b: 0, i: 0, v: 3 } };
  near(a.goalRolls!, 1 / weaponChance(table, { ...three, tier: "two" }), 1e-6, "average");
  // Not the 239 rolls of "any three useful lines" any more.
  assert.ok(a.goalRolls! > 5 * (1 / weaponChance(table, { ...three, tier: "v3" })));
  // The cubes cost their fee (Lv.250 = 1,250,000 each): spent, expected and profit are in that meso.
  const fee = cubeFee(250);
  assert.deepEqual([a.spent, a.resets, a.rolls, a.keptRolls], [4 * fee, 0, 4, null]);
  near(a.expected!, a.goalRolls! * fee, 1, "expected");
  near(a.delta!, a.expected! - a.spent, 1e-6, "profit");

  // The other way round (the old option was the harder one, a weaker one of the same class came up): kept.
  const back = [row({ ...weapon, before_potential_option: better, after_potential_option: old, date_create: at(30) })];
  const b = buildPotStats(potEntries(back, trackPieces(back)), NO_CONV).pieces[0];
  assert.deepEqual([b.option, b.goalBy, b.goalRolls], [better.map((o) => o.value), "", null]);
  // Kept, so no bar and what was spent is a loss — but what an option this good takes on average is there to read.
  assert.ok(b.spent > 0);
  assert.deepEqual([b.expected, b.delta, b.keptBy], [0, -b.spent, "공 · 보공 3줄 · 꽉이탈 2줄"]);
  near(b.keptRolls!, a.goalRolls!, 1e-6, "average of the kept option");
  near(b.keptMeso!, b.keptRolls! * fee, 1, "meso of the kept option");

  // Two options of the same tier and the same number of useful lines have the same chance: the one whose own
  // numbers are harder to roll (보공 40 + 30 + 30 over 보공 40 + 공 9 + 보공 30) is the one that was taken.
  const tieOld = opt("보스 몬스터 데미지 +40%", "공격력 +10%", "보스 몬스터 데미지 +35%");
  const tieNew = opt("보스 몬스터 데미지 +40%", "보스 몬스터 데미지 +35%", "보스 몬스터 데미지 +35%");
  const tie = [row({ ...weapon, before_potential_option: tieOld, after_potential_option: tieNew, date_create: at(40) })];
  const c = buildPotStats(potEntries(tie, trackPieces(tie)), NO_CONV).pieces[0];
  assert.deepEqual([c.option, c.goalBy], [tieNew.map((o) => o.value), "공 · 보공 3줄"]);
  const back2 = [row({ ...weapon, before_potential_option: tieNew, after_potential_option: tieOld, date_create: at(50) })];
  assert.deepEqual(buildPotStats(potEntries(back2, trackPieces(back2)), NO_CONV).pieces[0].goalRolls, null);
});

test("additional potential with all stat % and no main stat line is converted too (user, 2026-11-12)", () => {
  const conv = convFromSpec(STAT_CONV_DEFAULT);
  const gloves = row({ ...ADD, item_equipment_part: "장갑", item_level: 200 });
  const goal = goalOf(["크리티컬 데미지 +3%", "올스탯 +6%", "최대 HP +5%"], true)!;
  near(statWorth(goal, conv), 6 * conv.all + 3 * conv.cd, 1e-9, "worth");
  // One number for the whole option, not "크뎀 3 %" alone (that read as a 1-in-29 result).
  const hit = goalChance(gloves, "legendary", goal, conv)!;
  assert.match(hit.by, /^주스탯 \d+(\.\d)?%급$/);
  const shown = Math.floor(statWorth(goal, conv) * 10 + 1e-6) / 10;
  assert.equal(hit.p, sumChance(lineTables("white", "legendary", "gloves", 200)!, { type: "stat", min: shown - 1e-9, conv, attack: "atk" }));
  assert.ok(1 / hit.p > 29);
  // Main potential: all stat % alone is main stat too — 올스탯 10 · 10 · 7 on a mage's shoes is as good as INT 27 %,
  // and any option with that much main stat counts (user, 2026-11-13: as its own "올스탯 27 %" goal it read as
  // thousands of rolls, and the shoes came out as the luckiest item).
  const shoes = row();
  const all27 = goalChance(shoes, "legendary", goalOf(["올스탯 +10%", "올스탯 +10%", "올스탯 +7%"], false)!, conv)!;
  const int27 = goalChance(shoes, "legendary", goalOf(["올스탯 +10%", "INT +10%", "올스탯 +7%"], false)!, conv)!;
  assert.deepEqual([all27.by, int27.by], ["주스탯 27%", "INT 27%"]);
  assert.equal(all27.p, int27.p);
  near(1 / all27.p, 166.5, 0.5, "주스탯 27%");
  // Only a Xenon keeps it as a goal of its own, where a main stat line does not count: far rarer.
  const xenon = goalChance(shoes, "legendary", goalOf(["올스탯 +10%", "올스탯 +10%", "올스탯 +7%"], false, { xenon: true })!, conv)!;
  assert.equal(xenon.by, "올스탯 27%");
  assert.ok(xenon.p < all27.p / 5);
  // The job comes with the character: the same rolls are judged one way for a Xenon and the other way for a mage.
  const rolls = [row({ before_potential_option: opt("방어력 +7%", "이동속도 +9", "점프력 +9"), after_potential_option: opt("올스탯 +10%", "올스탯 +10%", "올스탯 +7%") })];
  const mage = buildPotStats(potEntries(rolls, trackPieces(rolls)), conv).pieces[0];
  const asXenon = buildPotStats(potEntries(rolls, trackPieces(rolls)), conv, new Set(["테스트"])).pieces[0];
  // (The mage's shoes of the default row are not a Xenon's gear whoever rolls them: a thief's pair is.)
  const thief = [row({ target_item: "에테르넬 시프슈즈", before_potential_option: opt("방어력 +7%", "이동속도 +9", "점프력 +9"), after_potential_option: opt("올스탯 +10%", "올스탯 +10%", "올스탯 +7%") })];
  const onThief = buildPotStats(potEntries(thief, trackPieces(thief)), conv).pieces[0];
  const onXenon = buildPotStats(potEntries(thief, trackPieces(thief)), conv, new Set(["테스트"])).pieces[0];
  // A thief's pair is a Xenon's to wear too, so it reads as the rarer all stat goal whoever rolled it: a thief
  // sells the pair that came out all stat alone (user, 2026-11-13).
  assert.deepEqual([mage.goalBy, asXenon.goalBy, onThief.goalBy, onXenon.goalBy], ["주스탯 27%", "주스탯 27%", "올스탯 27%", "올스탯 27%"]);
  assert.equal(onThief.goalRolls, onXenon.goalRolls);
  assert.ok(mage.goalRolls! < onThief.goalRolls! / 5);
});

test("prime cubes: the cube has a price, and line 1 is the one the item keeps", () => {
  const prime = (over: Partial<RawPotential> = {}) => row({ potential_type: undefined, cube_type: "프라임 큐브", item_equipment_part: "무기", item_level: 200, ...over });
  assert.deepEqual([cubeOf(prime()), pricedCube(prime()), pricedCube(row())], ["prime", "prime", null]);
  // Our price (프라임 큐브 7.4억 · 프라임 에디셔널 14.5억) plus the fee; the price the user set instead; 0 = the fee alone.
  const fee = cubeFee(200);
  assert.equal(rollMeso(prime()), 7.4e8 + fee);
  assert.equal(rollMeso(prime(), undefined, { prime: 5e8 }), 5e8 + fee);
  assert.equal(rollMeso(prime(), undefined, { prime: 0 }), fee);
  assert.equal(rollMeso(prime({ cube_type: "프라임 에디셔널 큐브" })), 14.5e8 + fee);
  // Other cubes and resets have no price of their own.
  assert.equal(rollMeso(prime({ cube_type: "카르마 블랙 큐브" }), undefined, { prime: 5e8 }), fee);

  // Line 1 (보공 40 %) stays and the other two are rolled: the calculator's prime cube with boss damage kept.
  const three = { attack: "atk" as const, ied: false, min: { a: 0, b: 0, i: 0, v: 3 }, tier: "v3" as const };
  const goal = goalOf(["보스 몬스터 데미지 +40%", "공격력 +9%", "보스 몬스터 데미지 +30%"], false)!;
  const hit = goalChance(prime(), "legendary", goal, NO_CONV)!;
  assert.equal(hit.by, "공 · 보공 3줄");
  assert.equal(hit.p, weaponChance(lineTables("prime", "legendary", "weapon", 200)!, three, "b"));
  // Two lines to roll instead of three: far likelier than the same option from a black cube.
  assert.ok(hit.p > 5 * goalChance(prime({ cube_type: "카르마 블랙 큐브" }), "legendary", goal, NO_CONV)!.p);
  // Armour: the kept INT 12 % line counts toward the total, the other two lines are rolled.
  const shoes = goalChance(prime({ item_equipment_part: "신발" }), "legendary", goalOf(["INT +12%", "INT +9%", "INT +9%"], false)!, NO_CONV)!;
  assert.equal(shoes.by, "INT 30%");
  assert.equal(shoes.p, sumChance(fixFirstLine(lineTables("prime", "legendary", "shoes", 200)!, "str", 12), { type: "stat", min: 30 - 1e-9, conv: NO_CONV, attack: "matk" }));
  // A kept line of another stat is worth nothing to an INT item: both rolled lines must be INT 9 % or more.
  const off = goalChance(prime({ item_equipment_part: "신발" }), "legendary", goalOf(["STR +12%", "INT +9%", "INT +9%"], false)!, NO_CONV)!;
  assert.equal(off.by, "INT 18%");
  assert.ok(off.p < shoes.p * 1.0001 && off.p > 0);

  // A kept line that cannot repeat (a "쓸만한" skill) is out of the other two lines, which makes the rest of them a
  // little likelier than after a line that is simply not counted (Codex review).
  const skill = goalOf(["<쓸만한 컴뱃 오더스> 스킬 사용 가능", "INT +9%", "INT +9%"], false)!;
  assert.deepEqual(skill.lines[0], ["skcombat", 0]);
  const afterSkill = goalChance(prime({ item_equipment_part: "신발" }), "legendary", skill, NO_CONV)!;
  assert.equal(afterSkill.p, sumChance(fixFirstLine(lineTables("prime", "legendary", "shoes", 200)!, "skcombat", 0), { type: "stat", min: 18 - 1e-9, conv: NO_CONV, attack: "matk" }));
  assert.ok(afterSkill.p > off.p * 1.05);
  assert.deepEqual(["피격 후 무적시간 +3초", "피격 시 5% 확률로 데미지의 20% 무시", "피격 시 2% 확률로 7초간 무적", "방어력 +7%"].map(cappedCategory), ["invtime", "ignp", "inv", ""]);

  // The piece: what was spent and what the same result costs on average are both in cube price + fee.
  const used = [prime({ before_potential_option: opt("보스 몬스터 데미지 +40%", "공격력 +9%", "최대 HP +9%"), after_potential_option: opt("보스 몬스터 데미지 +40%", "공격력 +9%", "보스 몬스터 데미지 +30%") })];
  const piece = buildPotStats(potEntries(used, trackPieces(used), {}, { prime: 5e8 }), NO_CONV).pieces[0];
  assert.deepEqual([piece.spent, piece.goalBy], [5e8 + fee, "공 · 보공 3줄"]);
  near(piece.expected!, (5e8 + fee) / hit.p, 1, "expected");
});

test("soul potential: its own history, price, table and goal (history/soul-potential, 2026-11-13)", () => {
  // The shape of a real answer (values made up): no level, no part, no potential_type.
  const soul = (over: Partial<RawPotential> = {}): PotRow =>
    parsePotential({
      id: `s${seq++}`,
      character_name: "테스트",
      date_create: "2026-09-27T00:30:18.209+09:00",
      item_upgrade_result: "실패",
      miracle_time_flag: "이벤트 적용되지 않음",
      soul_potential_amplified_grade: 4,
      target_item: "데스티니 데스페라도",
      soul_potential_grade: "레전드리",
      upgrade_guarantee: false,
      upgrade_guarantee_count: 0,
      before_soul_potential_option: opt("공격력 +2%", "최대 MP +1.5%", "몬스터 방어율 무시 +2%"),
      after_soul_potential_option: opt("STR +2%", "최대 MP +1.5%", "DEX +8"),
      ...over,
    })!;
  const a = soul();
  assert.deepEqual([a.soul, a.add, a.meso, a.part, a.level, a.grade, a.type, kindOf(a), cubeOf(a), slotOf(a.part)], [true, false, true, "소울", 4, "legendary", "소울 잠재능력 재설정", "soul", "soul", "soul"]);
  assert.deepEqual([a.before[1], a.after[2]], ["최대 MP +1.5%", "DEX +8"]);
  // Values with a decimal point are read too.
  assert.deepEqual([optionToken("최대 MP +1.5%"), optionToken("공격력 +4.5%")], [["mp", 1.5], ["atk", 4.5]]);
  // The soul reset's own price (the same at every stage), and the grade it had when it was paid for.
  assert.equal(rollMeso(a), resetMeso("soul", "legendary", 4));
  assert.equal(rollMeso(soul({ item_upgrade_result: "성공", soul_potential_grade: "유니크", soul_potential_amplified_grade: undefined })), resetMeso("soul", "epic", 1));
  // A weapon's soul is not its main potential: the two are kept apart under the same item name.
  const main = row({ target_item: "데스티니 데스페라도", item_equipment_part: "무기" });
  assert.notEqual(potKey(a), potKey(main));
  // Grade-up: the soul's own chance and ceiling, doubled in miracle time.
  near(upChance(soul({ soul_potential_grade: "레어" }), "rare")!.p, 0.015, 1e-12, "rare → epic");
  near(upChance(soul({ soul_potential_grade: "레어", miracle_time_flag: "이벤트 적용중" }), "rare")!.p, 0.03, 1e-12, "miracle time");

  // The goal: the attack % the option adds up to, from the top two values of the stage up — the soul goal the calculator has.
  const table = lineTables("soul", "legendary", "soul", 4)!;
  const values = [...new Set(table.flat().filter((r) => r[0] === "atk").map((r) => r[1]))].sort((x, y) => y - x);
  const [top, next] = values;
  const two = goalOf([`공격력 +${top}%`, `공격력 +${next}%`, "최대 MP +1.5%"], false)!;
  const hit = goalChance(a, "legendary", two, NO_CONV)!;
  assert.equal(hit.by, `공격력 ${top + next}%`);
  near(hit.p, addWeaponChance(table, "atk", "a21", false, SOUL_EXTRA), 1e-15, "the calculator's soul goal");
  // With a good line next to it ("+ @": all stat · main stat % · damage · boss damage): rarer.
  const plus = goalChance(a, "legendary", goalOf([`공격력 +${top}%`, `공격력 +${next}%`, "올스탯 +2%"], false)!, NO_CONV)!;
  assert.equal(plus.by, `공격력 ${top + next}% + @`);
  near(plus.p, addWeaponChance(table, "atk", "a21x", false, SOUL_EXTRA), 1e-15, "the calculator's + @");
  assert.ok(plus.p < hit.p);
  // Below the top two: the hardest single total, as for any option that has no goal of its own.
  assert.equal(goalChance(a, "legendary", goalOf([`공격력 +${next}%`, "최대 MP +1.5%", "DEX +8"], false)!, NO_CONV)!.by, `공격력 ${next}%`);

  // The soul tables write the main stat as STR: an INT · LUK line is asked the same way, not as a stat the table lacks.
  const stat = (name: string) => goalChance(a, "legendary", goalOf([`${name} +2%`, "최대 MP +1.5%", "DEX +8"], false)!, NO_CONV)!;
  assert.deepEqual([stat("STR").by, stat("INT").by, stat("LUK").by], ["STR 2%", "INT 2%", "LUK 2%"]);
  assert.equal(stat("INT").p, stat("STR").p);
  assert.equal(stat("LUK").p, stat("STR").p);

  // The piece: meso spent at the soul's price, marked as a soul one.
  const used = [soul({ before_soul_potential_option: opt("최대 MP +1.5%", "DEX +8", "STR +8"), after_soul_potential_option: opt(`공격력 +${top}%`, `공격력 +${next}%`, "최대 MP +1.5%") })];
  const piece = buildPotStats(potEntries(used, trackPieces(used)), NO_CONV).pieces[0];
  assert.deepEqual([piece.soul, piece.add, piece.spent, piece.goalBy], [true, false, resetMeso("soul", "legendary", 4), `공격력 ${top + next}%`]);
  near(piece.expected!, resetMeso("soul", "legendary", 4)! / hit.p, 1, "expected");
});

test("stat lines of another job are not the item's main stat; a Xenon's stat lines count a third as all stat (user, 2026-11-13)", () => {
  // The job is in the name of class gear: 루타비스 words too. Accessories are anyone's.
  assert.deepEqual(
    ["에테르넬 메이지글러브", "하이네스 던위치햇", "트릭스터 레인져팬츠", "이글아이 어새신셔츠", "하이네스 원더러햇", "앱솔랩스 나이트슈즈", "하이네스 워리어헬름", "마력이 깃든 안대"].map((name) => gearJob(name, "모자")),
    ["mage", "mage", "archer", "thief", "pirate", "warrior", "warrior", null]
  );
  assert.equal(gearJob("레드 워리어 마이스터 심볼", "얼굴장식"), null);
  // A mage's gloves: the LUK line is nobody's main stat there, so the option is its two crit lines alone.
  const mage = statRule({ item: "에테르넬 메이지글러브", part: "장갑" }, false);
  const gloves = row({ item_equipment_part: "장갑", item_level: 200, target_item: "아케인셰이드 메이지글러브" });
  const option = ["크리티컬 데미지 +8%", "크리티컬 데미지 +8%", "LUK +9%"];
  assert.equal(goalChance(gloves, "legendary", goalOf(option, false)!, NO_CONV)!.by, "크뎀 2줄 + LUK 9%");
  assert.equal(goalChance(gloves, "legendary", goalOf(option, false, mage)!, NO_CONV)!.by, "크뎀 2줄");
  // Its own stat and all stat still count; nothing but another job's stat is no goal at all.
  assert.equal(goalOf(["INT +12%", "LUK +12%", "올스탯 +6%"], false, mage)!.label, "INT 18%");
  assert.equal(goalOf(["LUK +12%", "LUK +9%", "방어력 +7%"], false, mage), null);
  // HP % is a demon avenger's: a goal on a warrior's piece (and on gear with no job in its name), not on a mage's.
  assert.equal(goalOf(["최대 HP +10%", "LUK +7%", "STR +7%"], false, mage), null);
  assert.equal(goalOf(["최대 HP +10%", "LUK +7%", "방어력 +7%"], false, statRule({ item: "아케인셰이드 나이트숄더", part: "어깨장식" }, false))!.label, "HP 10%");
  // A prime cube that keeps another job's stat on line 1: the kept line is worth nothing, it does not pass for the
  // main stat the all stat lines are asked as (Codex review, 2026-11-13).
  const primeShoes = row({ potential_type: undefined, cube_type: "프라임 큐브", item_level: 200, target_item: "아케인셰이드 메이지슈즈" });
  const keptStr = goalChance(primeShoes, "legendary", goalOf(["STR +12%", "올스탯 +9%", "올스탯 +6%"], false, mage)!, NO_CONV)!;
  assert.equal(keptStr.by, "주스탯 15%");
  near(keptStr.p, sumChance(fixFirstLine(lineTables("black", "legendary", "shoes", 200)!, "", 0), { type: "stat", min: 15 - 1e-9, conv: NO_CONV, attack: "atk" }), 1e-12, "kept STR line on a mage's shoes");
  assert.ok(keptStr.p < 0.05);
  // The same on gloves, where the stat is asked next to the crit line.
  const primeGloves = row({ potential_type: undefined, cube_type: "프라임 큐브", item_equipment_part: "장갑", item_level: 200, target_item: "아케인셰이드 메이지글러브" });
  const keptOnGloves = goalChance(primeGloves, "legendary", goalOf(["STR +12%", "크리티컬 데미지 +8%", "올스탯 +6%"], false, mage)!, NO_CONV)!;
  assert.equal(keptOnGloves.by, "크뎀 1줄 + 주스탯 6%");
  near(keptOnGloves.p, customChance(fixFirstLine(lineTables("black", "legendary", "gloves", 200)!, "", 0), [[{ cat: "cd", min: 8 }, { cat: "str", min: 6 }]]), 1e-12, "kept STR line on a mage's gloves");
  // A pirate's piece: STR or DEX, whichever the option has more of.
  assert.equal(goalOf(["DEX +12%", "STR +9%", "INT +9%"], false, statRule({ item: "아케인셰이드 파이렛햇", part: "모자" }, false))!.label, "DEX 12%");
  // No job in the name: as before.
  assert.deepEqual(statRule({ item: "마력이 깃든 안대", part: "눈장식" }, false), {});

  // A Xenon on its own gear: LUK 9 % is all stat 3 %.
  const xenon = statRule({ item: "아케인셰이드 시프슈즈", part: "신발" }, true);
  const mixed = goalOf(["올스탯 +9%", "올스탯 +9%", "LUK +9%"], false, xenon)!;
  assert.equal(mixed.label, "올스탯 21%");
  const shoes = row({ item_level: 200, target_item: "아케인셰이드 시프슈즈" });
  const hit = goalChance(shoes, "legendary", mixed, NO_CONV)!;
  assert.equal(hit.by, "올스탯 21%");
  // Likelier than three all stat lines, rarer than the same lines read as "LUK 27 %".
  const all24 = goalChance(shoes, "legendary", goalOf(["올스탯 +9%", "올스탯 +9%", "올스탯 +6%"], false, xenon)!, NO_CONV)!;
  const luk27 = goalChance(shoes, "legendary", goalOf(["올스탯 +9%", "올스탯 +9%", "LUK +9%"], false)!, NO_CONV)!;
  assert.ok(hit.p > all24.p && hit.p < luk27.p);
  // Thirds: LUK 12 + 12 + 9 = 올스탯 11 %, and one decimal rounded down otherwise.
  assert.equal(goalOf(["LUK +12%", "DEX +12%", "STR +9%"], false, xenon)!.label, "올스탯 11%");
  assert.equal(goalOf(["LUK +13%", "올스탯 +9%", "INT +12%"], false, xenon)!.label, "올스탯 13.3%");
  // A mage's piece rolled on a Xenon character is a mage's; additional potential is read as before.
  assert.deepEqual(statRule({ item: "에테르넬 메이지슈즈", part: "신발" }, true), { stats: ["int"] });
  assert.equal(goalOf(["LUK +6%", "올스탯 +4%", "방어력 +7%"], true, xenon)!.xenon, undefined);
  // The character's job reaches the pieces where the name has no job: the same rolls on an eye accessory read
  // "LUK 27%" for anyone else and "올스탯 21%" for a Xenon. (A thief's piece reads the same for both.)
  const rolls = [row({ item_level: 160, item_equipment_part: "눈장식", target_item: "마력이 깃든 안대", before_potential_option: opt("방어력 +7%", "이동속도 +9", "점프력 +9"), after_potential_option: opt("올스탯 +9%", "올스탯 +9%", "LUK +9%") })];
  const by = (xenons: Set<string>) => buildPotStats(potEntries(rolls, trackPieces(rolls)), NO_CONV, xenons).pieces[0].goalBy;
  assert.deepEqual([by(new Set()), by(new Set(["테스트"]))], ["LUK 27%", "올스탯 21%"]);
  // A Xenon also rolls a thief's or a pirate's piece to sell: stat lines alone are read as that job's, the rarer
  // reading — LUK 30 % is not "올스탯 10 %" (user, 2026-11-13).
  const soldBy = (xenons: string[], item: string, ...option: string[]) => {
    const list = [row({ item_level: 200, target_item: item, before_potential_option: opt("방어력 +7%", "이동속도 +9", "점프력 +9"), after_potential_option: opt(...option) })];
    return buildPotStats(potEntries(list, trackPieces(list)), NO_CONV, new Set(xenons)).pieces[0].goalBy;
  };
  const sold = (item: string, ...option: string[]) => soldBy(["테스트"], item, ...option);
  // The other way round: a thief's piece that a thief rolled all stat alone is a Xenon's item to sell. With a LUK
  // line it is the thief's own LUK 27 %: only a Xenon character's mixed option is read the Xenon way.
  assert.equal(soldBy([], "아케인셰이드 시프슈즈", "올스탯 +9%", "올스탯 +9%", "올스탯 +6%"), "올스탯 24%");
  assert.equal(soldBy([], "이글아이 원더러코트", "올스탯 +9%", "올스탯 +9%", "올스탯 +6%"), "올스탯 24%");
  assert.equal(soldBy([], "아케인셰이드 시프슈즈", "올스탯 +9%", "올스탯 +9%", "LUK +9%"), "LUK 27%");
  assert.equal(soldBy([], "아케인셰이드 파이렛슈즈", "올스탯 +9%", "올스탯 +9%", "STR +9%"), "STR 27%");
  assert.equal(sold("아케인셰이드 시프슈즈", "올스탯 +9%", "올스탯 +9%", "LUK +9%"), "올스탯 21%");
  // Additional potential of a thief's piece rolled by a thief stays the thief's: a STR line is not its main stat.
  const thiefAdd = statRules({ item: "아케인셰이드 시프슈즈", part: "신발" }, false);
  const addOption = ["캐릭터 기준 9레벨 당 STR +2", "올스탯 +4%", "공격력 +10"];
  assert.equal(goalOf(addOption, true, thiefAdd[1]), null);
  assert.equal(goalOf(addOption, true, thiefAdd[0])!.stat, "");
  const addRolls = [row({ ...ADD, item_level: 200, target_item: "아케인셰이드 시프슈즈", before_additional_potential_option: opt("방어력 +7%", "이동속도 +9", "점프력 +9"), after_additional_potential_option: opt(...addOption) })];
  assert.match(buildPotStats(potEntries(addRolls, trackPieces(addRolls)), convFromSpec(STAT_CONV_DEFAULT)).pieces[0].goalBy, /^주스탯 /);
  assert.equal(soldBy([], "아케인셰이드 시프슈즈", "LUK +12%", "LUK +9%", "LUK +9%"), "LUK 30%");
  assert.equal(soldBy([], "아케인셰이드 메이지슈즈", "올스탯 +9%", "올스탯 +9%", "올스탯 +6%"), "주스탯 24%");
  assert.equal(sold("아케인셰이드 시프슈즈", "LUK +12%", "LUK +9%", "LUK +9%"), "LUK 30%");
  assert.equal(sold("아케인셰이드 파이렛슈즈", "DEX +12%", "DEX +9%", "올스탯 +6%"), "DEX 27%");
  // STR on a thief's piece is nobody's to buy: only the Xenon reads it.
  assert.equal(sold("아케인셰이드 시프슈즈", "STR +12%", "DEX +9%", "올스탯 +9%"), "올스탯 16%");
  assert.deepEqual(statRules({ item: "아케인셰이드 시프슈즈", part: "신발" }, true), [{ stats: ["luk"] }, { stats: ["str", "dex", "luk"], xenon: true }]);
  assert.deepEqual(statRules({ item: "에테르넬 메이지슈즈", part: "신발" }, true), [{ stats: ["int"] }]);
  assert.deepEqual(statRules({ item: "아케인셰이드 시프슈즈", part: "신발" }, false), [{ stats: ["luk"] }, { stats: ["str", "dex", "luk"], xenon: true, allOnly: true }]);
  assert.deepEqual(statRules({ item: "마력이 깃든 안대", part: "눈장식" }, false), [{}]);
  assert.deepEqual(statRules({ item: "마력이 깃든 안대", part: "눈장식" }, true), [{}, { stats: ["str", "dex", "luk"], xenon: true }]);
});
