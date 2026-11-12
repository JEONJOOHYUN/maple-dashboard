import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_CONV, addWeaponChance, convFromScouter, lineTables, resetMeso, sumChance, weaponChance } from "../ev/potential.ts";
import { STAT_CONV_DEFAULT } from "../ev/defaults.ts";
import { buildPotStats, potEntries } from "./pot-stats.ts";
import { cubeOf, goalChance, goalOf, gradeBefore, optionToken, parsePotential, rollMeso, rollsToUp, slotOf, statWorth, trackPieces, upChance, upRolls, type PotRow, type RawPotential } from "./potential.ts";

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
  assert.deepEqual([cube.meso, cube.type, cubeOf(cube), rollMeso(cube)], [false, "카르마 블랙 큐브", "black", 0]);
  assert.equal(parsePotential({ id: "x" }), null);
});

test("price of a roll: the grade the item had when it was paid for", () => {
  assert.equal(rollMeso(row()), resetMeso("black", "legendary", 250));
  assert.equal(rollMeso(row({ item_upgrade_result: "성공", potential_option_grade: "유니크" })), resetMeso("black", "epic", 250));
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
  const conv = convFromScouter(STAT_CONV_DEFAULT);
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
  assert.equal(shield.by, "유효 3줄");
  assert.equal(shield.p, weaponChance(lineTables("black", "legendary", "sub", 200)!, v(3, true)));
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

test("weapons, additional potential: attack % 21, with @, or three lines", () => {
  const sub = row({ ...ADD, item_equipment_part: "포스실드소울링", item_level: 200 });
  const rows = lineTables("white", "legendary", "sub", 200)!;
  const a21 = goalChance(sub, "legendary", goalOf(["공격력 +12%", "공격력 +9%", "최대 HP +8%"], true)!, NO_CONV)!;
  assert.deepEqual([a21.by, a21.p], ["공격력 21%", addWeaponChance(rows, "atk", "a21")]);
  const a21x = goalChance(sub, "legendary", goalOf(["마력 +12%", "마력 +9%", "INT +9%"], true)!, NO_CONV)!;
  assert.deepEqual([a21x.by, a21x.p], ["마력 21% + @", addWeaponChance(rows, "matk", "a21x")]);
  const a3 = goalChance(sub, "legendary", goalOf(["마력 +12%", "마력 +9%", "마력 +9%"], true)!, NO_CONV)!;
  assert.deepEqual([a3.by, a3.p], ["마력 3줄", addWeaponChance(rows, "matk", "a3")]);
  assert.ok(a3.p < a21x.p && a21x.p < a21.p);
  // 공격력 12 % + 9 % with an INT line is still 공격력 21 % (it was read as "INT 9 %", about 4 rolls).
  const warrior = goalChance(row({ ...ADD, item_equipment_part: "무기", item_level: 200 }), "legendary", goalOf(["공격력 +12%", "공격력 +9%", "INT +9%"], true)!, NO_CONV)!;
  assert.deepEqual([warrior.by, warrior.p], ["공격력 21% + @", addWeaponChance(lineTables("white", "legendary", "weapon", 200)!, "atk", "a21x")]);
  assert.ok(1 / warrior.p > 213);
});

test("gloves with crit damage and hats with cooldown: special lines plus main stat lines", () => {
  const gloves = row({ item_equipment_part: "장갑", item_level: 200 });
  const gRows = lineTables("black", "legendary", "gloves", 200)!;
  const cc = goalChance(gloves, "legendary", goalOf(["크리티컬 데미지 +8%", "크리티컬 데미지 +8%", "INT +12%"], false)!, NO_CONV)!;
  assert.deepEqual([cc.by, cc.p], ["크뎀 2줄 + INT 1줄", sumChance(gRows, { type: "combo", special: "cd", lines: 2, stat: 1, minSpecial: 3 })]);
  const c = goalChance(gloves, "legendary", goalOf(["크리티컬 데미지 +8%", "방어력 +7%", "이동속도 +9"], false)!, NO_CONV)!;
  assert.deepEqual([c.by, c.p], ["크뎀 1줄", sumChance(gRows, { type: "combo", special: "cd", lines: 1, stat: 0, minSpecial: 3 })]);
  // Gloves without a crit damage line are plain armour.
  assert.equal(goalChance(gloves, "legendary", goalOf(["INT +12%", "INT +9%", "INT +9%"], false)!, NO_CONV)!.by, "INT 30%");

  const hat = row({ item_equipment_part: "모자", item_level: 200 });
  const hRows = lineTables("black", "legendary", "hat", 200)!;
  const four = goalChance(hat, "legendary", goalOf([COOL2, COOL2, "방어력 +7%"], false)!, NO_CONV)!;
  assert.deepEqual([four.by, four.p], ["쿨감 4초", sumChance(hRows, { type: "cool", min: 4 })]);
  const mixed = goalChance(hat, "legendary", goalOf([COOL2, "INT +12%", "INT +9%"], false)!, NO_CONV)!;
  assert.deepEqual([mixed.by, mixed.p], ["쿨감 2초 + INT 2줄", sumChance(hRows, { type: "combo", special: "cool", lines: 1, stat: 2, minSpecial: 2 })]);
  const two = goalChance(hat, "legendary", goalOf([COOL2, COOL1, "INT +12%"], false)!, NO_CONV)!;
  assert.deepEqual([two.by, two.p], ["쿨감 2줄 + INT 1줄", sumChance(hRows, { type: "combo", special: "cool", lines: 2, stat: 1, minSpecial: 1 })]);
});

test("accessories: drop rate and meso lines count together, next to the stat", () => {
  const ring = row({ item_equipment_part: "반지", item_level: 160 });
  const rows = lineTables("black", "legendary", "ring", 160)!;
  const hit = goalChance(ring, "legendary", goalOf(["아이템 드롭률 +20%", "메소 획득량 +20%", "INT +9%"], false)!, NO_CONV)!;
  assert.deepEqual([hit.by, hit.p], ["드메 2줄", sumChance(rows, { type: "drop", lines: 2 })]);
});

test("converted number: shown rounded down, and the chance is of the number shown", () => {
  const conv = convFromScouter(STAT_CONV_DEFAULT);
  // 기계심장 에디셔널 유니크: INT 6 % + 마력 11 + 올스탯 2 % = 10.77 % with the default conversion.
  const heart = row({ ...ADD, additional_potential_option_grade: "유니크", item_equipment_part: "기계심장", item_level: 200 });
  const goal = goalOf(["INT +6%", "마력 +11", "올스탯 +2%"], true)!;
  near(statWorth(goal, conv), 10.771, 0.001, "worth");
  const hit = goalChance(heart, "unique", goal, conv)!;
  // "10.8 %급" with the average of 10.77 was 789 rolls here while the calculator said 876 for 10.8.
  assert.equal(hit.by, "INT 10.7%급");
  assert.equal(hit.p, sumChance(lineTables("white", "unique", "heart", 200)!, { type: "stat", min: 10.7 - 1e-9, conv, attack: "matk" }));
  near(1 / hit.p, 789.2, 0.1, "INT 10.7%급");
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

test("cubes: prime cubes are their own kind and get no average", () => {
  const prime = row({ potential_type: undefined, cube_type: "프라임 에디셔널 큐브", additional_potential_option_grade: "레전드리", before_potential_option: [], after_potential_option: [], before_additional_potential_option: opt("마력 +12%"), after_additional_potential_option: opt("마력 +12%"), item_equipment_part: "무기", item_level: 200 });
  assert.deepEqual([prime.add, cubeOf(prime)], [true, "primeAddi"]);
  assert.equal(cubeOf(row({ potential_type: undefined, cube_type: "프라임 큐브" })), "prime");
  assert.equal(goalChance(prime, "legendary", goalOf(["마력 +12%", "마력 +9%", "마력 +9%"], true)!, NO_CONV), null);
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
  assert.deepEqual([a.option, a.goalBy, a.goalRolls, a.expected, a.delta], [["INT +13%", "INT +13%", "최대 MP +10%"], "", null, null, null]);
  assert.equal(a.phases[0].expected, null);
  assert.ok(a.spent > 0);
  // The same option, but one of these rolls produced it: it was won here, and the later rolls did not beat it.
  const won: PotRow[] = [row({ before_potential_option: junk, after_potential_option: good, date_create: at(20) })];
  for (let i = 1; i < 10; i++) won.push(row({ before_potential_option: good, after_potential_option: junk, date_create: at(20 + i) }));
  const b = buildPotStats(potEntries(won, trackPieces(won)), NO_CONV).pieces[0];
  assert.equal(b.goalBy, "INT 26%");
  assert.ok(b.goalRolls !== null && b.delta !== null);
});
