// 잠재능력 기록: NEXON Open API history/potential (잠재능력 재설정, meso) and history/cube (cash cubes).
// Shapes checked against real responses on 2026-11-12:
// - one row = one roll. "3회 연속 재설정" arrives as three rows with the same timestamp (the ceiling counter goes up
//   by one on each), all with the same "before" option; the user then keeps the old option or takes one of the three.
// - potential_option_grade / additional_potential_option_grade = the item's grade AFTER the roll;
//   item_upgrade_result "성공" = the roll raised the grade.
// - unlike star force, the rows carry item level and equipment part.
import { CREDIT_SHOP } from "../ev/defaults.ts";
import { CUBES, NEXT_GRADE, NO_CONV, SLOTS, SOUL_EXTRA, WEAPON_TIERS, addWeaponNeed, addWeaponSumChance, customChance, fixFirstLine, gradeUp, lineTables, resetMeso, sumChance, weaponChance, weaponTierOf, type CubeId, type CustomCond, type Grade, type StatConv } from "../ev/potential.ts";

export type RawOption = { value?: string; grade?: string };
export type RawPotential = {
  id?: string;
  character_name?: string;
  date_create?: string;
  /** history/potential: "잠재능력 재설정" · "에디셔널 잠재능력 재설정". */
  potential_type?: string;
  /** history/cube: "카르마 블랙 큐브" · "메멘토 골드 큐브 (200제)" … */
  cube_type?: string;
  item_upgrade_result?: string;
  miracle_time_flag?: string;
  item_equipment_part?: string;
  item_level?: number;
  target_item?: string;
  potential_option_grade?: string;
  additional_potential_option_grade?: string;
  upgrade_guarantee?: boolean;
  upgrade_guarantee_count?: number;
  before_potential_option?: RawOption[];
  before_additional_potential_option?: RawOption[];
  after_potential_option?: RawOption[];
  after_additional_potential_option?: RawOption[];
  /** history/soul-potential (checked against real responses, 2026-11-13): the soul on a weapon has its own potential. */
  soul_potential_grade?: string;
  /** Amplification stage of the soul, 1 ~ 4: its option tables go by it. */
  soul_potential_amplified_grade?: number;
  before_soul_potential_option?: RawOption[];
  after_soul_potential_option?: RawOption[];
};

/** One roll, trimmed for IndexedDB. */
export type PotRow = {
  id: string;
  t: number;
  who: string;
  item: string;
  part: string;
  level: number;
  /** "잠재능력 재설정" or the cube's name. */
  type: string;
  /** Paid with meso (재설정) rather than a cash cube. */
  meso: boolean;
  /** Additional potential (에디셔널) rather than the main one. */
  add: boolean;
  /** Soul potential (소울 잠재능력 재설정): `item` is the weapon the soul is on, `level` its amplification stage. */
  soul?: boolean;
  /** Grade after the roll, and whether this roll raised it. */
  grade: Grade | null;
  up: boolean;
  /** Miracle time (grade-up chance doubled). */
  mt: boolean;
  /** Option lines before and after the roll. */
  before: string[];
  after: string[];
};

const GRADES: Record<string, Grade> = { 레어: "rare", 에픽: "epic", 유니크: "unique", 레전드리: "legendary" };
const LOWER: Partial<Record<Grade, Grade>> = { epic: "rare", unique: "epic", legendary: "unique" };
const lines = (list: RawOption[] | undefined) => (Array.isArray(list) ? list.map((o) => o.value ?? "") : []);

/** 잠재능력 · 에디셔널 · 소울: the three potentials one item can carry, each rolled and kept on its own. */
export type PotKind = "main" | "add" | "soul";
export const kindOf = (row: { add: boolean; soul?: boolean }): PotKind => (row.soul ? "soul" : row.add ? "add" : "main");

export function parsePotential(raw: RawPotential): PotRow | null {
  const t = Date.parse(raw.date_create ?? "");
  if (!raw.id || !Number.isFinite(t)) return null;
  if (raw.soul_potential_grade !== undefined || raw.before_soul_potential_option !== undefined) {
    return {
      id: raw.id,
      t,
      who: raw.character_name ?? "",
      item: raw.target_item ?? "",
      part: "소울",
      level: typeof raw.soul_potential_amplified_grade === "number" ? raw.soul_potential_amplified_grade : 0,
      type: "소울 잠재능력 재설정",
      meso: true,
      add: false,
      soul: true,
      grade: GRADES[raw.soul_potential_grade ?? ""] ?? null,
      up: raw.item_upgrade_result === "성공",
      mt: typeof raw.miracle_time_flag === "string" && raw.miracle_time_flag !== "" && !raw.miracle_time_flag.includes("않"),
      before: lines(raw.before_soul_potential_option),
      after: lines(raw.after_soul_potential_option),
    };
  }
  const type = raw.potential_type ?? raw.cube_type ?? "";
  const mainBefore = lines(raw.before_potential_option);
  const mainAfter = lines(raw.after_potential_option);
  // A cube name says which potential it rolls; when it does not, the side that has lines is the one rolled.
  const add = type.includes("에디셔널") || (mainBefore.length === 0 && mainAfter.length === 0);
  return {
    id: raw.id,
    t,
    who: raw.character_name ?? "",
    item: raw.target_item ?? "",
    part: raw.item_equipment_part ?? "",
    level: typeof raw.item_level === "number" ? raw.item_level : 0,
    type,
    meso: raw.potential_type !== undefined,
    add,
    grade: GRADES[(add ? raw.additional_potential_option_grade : raw.potential_option_grade) ?? ""] ?? null,
    up: raw.item_upgrade_result === "성공",
    mt: typeof raw.miracle_time_flag === "string" && raw.miracle_time_flag !== "" && !raw.miracle_time_flag.includes("않"),
    before: add ? lines(raw.before_additional_potential_option) : mainBefore,
    after: add ? lines(raw.after_additional_potential_option) : mainAfter,
  };
}

/** Grade the item had when the roll was paid for. */
export const gradeBefore = (row: PotRow): Grade | null => (row.up && row.grade ? (LOWER[row.grade] ?? row.grade) : row.grade);

/** Which option table a roll uses. */
export function cubeOf(row: PotRow): CubeId | null {
  if (row.soul) return "soul";
  if (row.meso) return row.add ? "white" : "black";
  const name = row.type;
  // Prime cubes keep line 1 and reroll the other two: not the same odds as the cube they share a table with.
  if (name.includes("프라임")) return name.includes("에디셔널") ? "primeAddi" : "prime";
  if (name.includes("에디셔널")) return name.includes("브론즈") || name.includes("수상한") ? "bronze" : "white";
  if (name.includes("블랙")) return "black";
  if (name.includes("골드") || name.includes("명장")) return "gold";
  if (name.includes("실버") || name.includes("장인")) return "silver";
  return null;
}

/** 통찰력 level from which the fee is waived: items up to Lv.70 at 60, up to Lv.120 at 90 (user, 2026-11-12). */
const INSIGHT_FREE_70 = 60;
const INSIGHT_FREE_120 = 90;

/**
 * Meso a cube takes each time it is used ("감정 비용"), by the item's level L and the character's 통찰력:
 * Lv.121 and up 20 L² always · Lv.71~120 2.5 L², free from 통찰력 90 · Lv.31~70 0.25 L², free from 통찰력 60 ·
 * Lv.30 and under free. `insight` = the character's level today (the history has no level of its own), undefined
 * when it is not known: then the fee counts as waived, as it is for most characters that roll cubes.
 * Formula from the user (0.5 L² is also seen for Lv.31~70 — a few hundred meso a cube either way).
 */
export function cubeFee(level: number, insight?: number): number {
  if (level >= 121) return level * level * 20;
  if (insight === undefined) return 0;
  if (level >= 71) return insight >= INSIGHT_FREE_120 ? 0 : Math.floor(level * level * 2.5);
  if (level >= 31) return insight >= INSIGHT_FREE_70 ? 0 : Math.floor(level * level * 0.25);
  return 0;
}

/** Whether what a cube roll costs depends on the character's 통찰력 (so the level is worth asking for). */
export const feeByInsight = (row: PotRow) => !row.meso && row.level >= 31 && row.level <= 120 && row.type.includes("큐브");

/** Cubes that are bought with meso on the auction house, so one of them is worth a price: the prime cubes. */
export type PricedCube = "prime" | "primeAddi";
export const PRICED_CUBES: PricedCube[] = ["prime", "primeAddi"];
/** Meso for one cube, by the user ("" = our default). */
export type CubePrices = Partial<Record<PricedCube, number>>;
/** Our price for one cube in meso: the auction price the MVP page uses (lib/ev/defaults.ts CREDIT_SHOP). */
export const cubePriceDefault = (cube: PricedCube): number => (CREDIT_SHOP.find((x) => x.id === cube)?.auctionEok ?? 0) * 1e8;

/** The priced cube a roll used, or null (a reset, or a cube that is not traded for meso). */
export function pricedCube(row: PotRow): PricedCube | null {
  if (row.meso) return null;
  const cube = cubeOf(row);
  return cube === "prime" || cube === "primeAddi" ? cube : null;
}

/**
 * Meso paid for the roll: the reset's price, or the fee a cube takes (nothing for what is not a cube, e.g. 펄스 인핸서).
 * A prime cube also costs the cube itself: `prices` = what the user set for one, else our default.
 * `insight` = the 통찰력 level of the character that rolled, when known.
 */
export function rollMeso(row: PotRow, insight?: number, prices: CubePrices = {}): number {
  // A soul reset costs the same at every amplification stage: it needs no level.
  if (row.soul) {
    const before = gradeBefore(row);
    return before ? (resetMeso("soul", before, 0) ?? 0) : 0;
  }
  const priced = pricedCube(row);
  const cube = priced ? (prices[priced] ?? cubePriceDefault(priced)) : 0;
  if (row.level <= 0) return cube;
  if (!row.meso) return row.type.includes("큐브") ? cubeFee(row.level, insight) + cube : 0;
  const grade = gradeBefore(row);
  return grade ? (resetMeso(row.add ? "white" : "black", grade, row.level) ?? 0) : 0;
}

// ── Option text → the calculator's category ──

const STAT: Record<string, string> = { STR: "str", DEX: "dex", INT: "int", LUK: "luk" };
const RULES: [RegExp, (m: RegExpMatchArray) => [string, number]][] = [
  [/^(STR|DEX|INT|LUK) \+(\d+(?:\.\d+)?)%$/, (m) => [STAT[m[1]], +m[2]]],
  [/^(STR|DEX|INT|LUK) \+(\d+)$/, (m) => [`f${STAT[m[1]]}`, +m[2]]],
  [/^캐릭터 기준 \d+레벨 당 (STR|DEX|INT|LUK) \+(\d+)$/, (m) => [`lv${STAT[m[1]]}`, +m[2]]],
  [/^올스탯 \+(\d+(?:\.\d+)?)%$/, (m) => ["all", +m[1]]],
  [/^최대 HP \+(\d+(?:\.\d+)?)%$/, (m) => ["hp", +m[1]]],
  [/^최대 MP \+(\d+(?:\.\d+)?)%$/, (m) => ["mp", +m[1]]],
  [/^최대 HP \+(\d+)$/, (m) => ["fhp", +m[1]]],
  [/^최대 MP \+(\d+)$/, (m) => ["fmp", +m[1]]],
  [/^공격력 \+(\d+(?:\.\d+)?)%$/, (m) => ["atk", +m[1]]],
  [/^마력 \+(\d+(?:\.\d+)?)%$/, (m) => ["matk", +m[1]]],
  [/^공격력 \+(\d+)$/, (m) => ["atkf", +m[1]]],
  [/^마력 \+(\d+)$/, (m) => ["matkf", +m[1]]],
  [/^데미지 \+(\d+(?:\.\d+)?)%$/, (m) => ["dmg", +m[1]]],
  [/^보스 몬스터.*데미지 \+(\d+(?:\.\d+)?)%$/, (m) => ["boss", +m[1]]],
  [/^몬스터 방어율 무시 \+(\d+(?:\.\d+)?)%$/, (m) => ["ied", +m[1]]],
  [/^크리티컬 확률 \+(\d+)%$/, (m) => ["crit", +m[1]]],
  [/^크리티컬 데미지 \+(\d+)%$/, (m) => ["cd", +m[1]]],
  [/^아이템 드롭률 \+(\d+)%$/, (m) => ["drop", +m[1]]],
  [/^메소 획득량 \+(\d+)%$/, (m) => ["meso", +m[1]]],
  [/재사용 대기시간 -(\d+)초/, (m) => ["cool", +m[1]]],
];

/** [category, value] of one option line, or null for lines the page does not rank (defence, recovery …). */
export function optionToken(text: string): [string, number] | null {
  for (const [re, make] of RULES) {
    const m = text.match(re);
    if (m) return make(m);
  }
  return null;
}

/**
 * Options that cannot fill all three lines ("쓸만한" skills and 피격 후 무적시간 once, 피격 시 데미지 % 무시 and 피격 시 무적
 * twice): the calculator's category for one, "" for any other line. They are not ranked, but a prime cube that keeps
 * one on line 1 rolls the other two lines without it, so the line has to stay known for what it is (Codex review,
 * 2026-11-12: read as nothing, 쓸만한 컴뱃 오더스 kept on shoes made STR 9 % + 9 % a 1.37 % roll instead of 1.61 %).
 * Wording as in NEXON's cube guide (the table's source); matched loosely in case the API spaces it differently.
 */
const CAPPED: [RegExp, string][] = [
  [/쓸만한\s*샤프\s*아이즈/, "sksharp"],
  [/쓸만한\s*윈드\s*부스터/, "skwind"],
  [/쓸만한\s*컴뱃\s*오더스/, "skcombat"],
  [/쓸만한\s*어드밴스드\s*블레스/, "skbless"],
  [/쓸만한\s*하이퍼\s*바디/, "skhyper"],
  [/쓸만한\s*헤이스트/, "skhaste"],
  [/쓸만한\s*미스틱\s*도어/, "skdoor"],
  [/피격 후 무적시간/, "invtime"],
  [/피격 시 \d+% 확률로 데미지의 \d+% 무시/, "ignp"],
  [/피격 시 \d+% 확률로 \d+초간 무적/, "inv"],
];
export const cappedCategory = (text: string): string => CAPPED.find(([re]) => re.test(text))?.[1] ?? "";

// ── What the item ended with, as a goal ──

const MAIN_STATS = ["str", "dex", "int", "luk"];
/** Lines that count as "wanted" on top of the main stat. Main potential and additional potential differ. */
const WANTED_MAIN = ["boss", "ied", "atk", "matk", "dmg", "cd", "drop", "meso", "cool"];
const WANTED_ADD = ["boss", "ied", "atk", "matk", "atkf", "matkf", "dmg", "cd", "cool", "lvstr", "lvdex", "lvint", "lvluk"];

/**
 * `stat` = the item's main stat ("" when the option has none), `magic` = magic attack rather than attack,
 * `sums` = every ranked line total by category, `lines` = the option line by line: ["", 0] for a line that is not
 * ranked, [its category, 0] for an unranked one that cannot repeat (cappedCategory).
 * `xenon` = read as a Xenon's (StatRule): the "all" condition then holds STR · DEX · LUK % at a third each.
 */
export type Goal = { conds: CustomCond[]; label: string; stat: string; magic: boolean; sums: Record<string, number>; lines: [string, number][]; xenon?: boolean };

// ── Whose gear it is: the stats that count on it ──

/** The job a piece of class gear is for. */
export type GearJob = "warrior" | "mage" | "archer" | "thief" | "pirate";

/**
 * The job word in the name of class gear (user, 2026-11-13). 에테르넬 · 아케인셰이드 · 앱솔랩스 use 나이트 · 메이지 ·
 * 아처 · 시프 · 파이렛; the 루타비스 set (하이네스 · 이글아이 · 트릭스터) uses 워리어 · 던위치 · 레인져 · 어새신 · 원더러 —
 * spellings as in the item names the API returned (public.item_dict, 2026-11-13: 하이네스 워리어헬름, 이글아이
 * 던위치로브, 트릭스터 레인져팬츠, 하이네스 어새신보닛, 이글아이 원더러코트 …).
 */
const JOB_WORDS: [RegExp, GearJob][] = [
  [/나이트|워리어/, "warrior"],
  [/메이지|던위치/, "mage"],
  [/아처|레인져/, "archer"],
  [/시프|어새신/, "thief"],
  [/파이렛|원더러/, "pirate"],
];
/** Main stats of each job's gear. Pirates are STR or DEX, by the character. */
const JOB_STATS: Record<GearJob, readonly string[]> = { warrior: ["str"], mage: ["int"], archer: ["dex"], thief: ["luk"], pirate: ["str", "dex"] };
/** A Xenon's damage goes with STR + DEX + LUK. */
const XENON_STATS: readonly string[] = ["str", "dex", "luk"];

/**
 * The job an item is for, told by its name; null when the name does not say (most gear: then nothing is left out).
 * Accessories are anyone's whatever they are called (레드 워리어 마이스터 심볼 is a face accessory).
 */
export function gearJob(item: string, part: string): GearJob | null {
  if (SLOTS.find((x) => x.id === slotOf(part))?.kind === "acc") return null;
  return JOB_WORDS.find(([re]) => re.test(item))?.[1] ?? null;
}

/**
 * How the stat lines of an option are read.
 * `stats` = the main stats that count on the item (undefined = any of the four): a LUK line on a mage's gloves is
 * not that item's main stat (user, 2026-11-13: 메이지글러브 with 크뎀 2줄 + LUK 10 % ranked as a lucky item).
 * `xenon` = a Xenon's own gear (main potential only, see goalOf): all stat % is the goal, and STR · DEX · LUK % lines count toward it
 * at a third each (all stat 1 % raises all three; user, 2026-11-13) — "LUK 9 % + 올스탯 9 % + 9 %" is "올스탯 21 %".
 */
export type StatRule = { stats?: readonly string[]; xenon?: boolean; allOnly?: boolean };

/**
 * The ways an item can be read: by the job of the gear, and the Xenon way next to it where a Xenon can wear it.
 * A thief's or a pirate's piece is both (user, 2026-11-13): a Xenon rolls LUK on a thief's piece or STR · DEX on a
 * pirate's to sell, and a thief sells the piece that came out all stat alone — for a character that is not a Xenon
 * only that one, an option with no STR · DEX · LUK % line (`allOnly`): 올스탯 9 + 9 + LUK 9 is its own LUK 27 %.
 * Gear with no job in its name is read the Xenon way only when a Xenon rolled it (`xenon`). The reading that makes
 * the option the rarer one is the one it was kept for.
 */
export function statRules(row: Pick<PotRow, "item" | "part" | "soul">, xenon: boolean): StatRule[] {
  if (row.soul) return [{}];
  const job = gearJob(row.item, row.part);
  const plain: StatRule = job ? { stats: JOB_STATS[job] } : {};
  const wearable = job === "thief" || job === "pirate";
  if (xenon && (wearable || !job)) return [plain, { stats: XENON_STATS, xenon: true }];
  return wearable ? [plain, { stats: XENON_STATS, xenon: true, allOnly: true }] : [plain];
}

/** One reading of an item: by the job of the gear, or (`xenon`) the Xenon way where the gear is a Xenon's to wear. */
export function statRule(row: Pick<PotRow, "item" | "part" | "soul">, xenon: boolean): StatRule {
  // A soul's tables name one stand-in stat, and its item is the weapon it sits on: read as before.
  if (row.soul) return {};
  const job = gearJob(row.item, row.part);
  // A Xenon wears thief and pirate gear (and what has no job in its name). A mage's, warrior's or archer's piece
  // rolled on a Xenon character is for someone else.
  if (xenon && (!job || job === "thief" || job === "pirate")) return { stats: XENON_STATS, xenon: true };
  return job ? { stats: JOB_STATS[job] } : {};
}

/** One decimal, rounded down: the number shown, and the chance asked is of that number or more. */
const floor1 = (v: number) => Math.floor(v * 10 + 1e-6) / 10;
const EPS = 1e-9;

/** All stat % a Xenon gets from an option: its all stat lines plus a third of its STR · DEX · LUK % lines. */
export const xenonAll = (sums: Record<string, number>) => floor1((sums.all ?? 0) + XENON_STATS.reduce((sum, c) => sum + (sums[c] ?? 0), 0) / 3);

export const condLabel = (c: CustomCond) => `${LABEL[c.cat] ?? c.cat} ${c.min}${UNIT[c.cat] ?? "%"}`;

const LABEL: Record<string, string> = {
  str: "STR", dex: "DEX", int: "INT", luk: "LUK", hp: "HP", all: "올스탯",
  boss: "보공", ied: "방무", atk: "공격력", matk: "마력", atkf: "공격력 +", matkf: "마력 +", dmg: "데미지", cd: "크뎀",
  drop: "드롭", meso: "메획", cool: "쿨감", lvstr: "9렙당 STR", lvdex: "9렙당 DEX", lvint: "9렙당 INT", lvluk: "9렙당 LUK",
  fstr: "STR +", fdex: "DEX +", fint: "INT +", fluk: "LUK +",
};
const UNIT: Record<string, string> = { cool: "초", atkf: "", matkf: "", lvstr: "", lvdex: "", lvint: "", lvluk: "", fstr: "", fdex: "", fint: "", fluk: "" };

/**
 * The option an item was left with, read as "this much or more":
 * - main stat = the one of STR · DEX · INT · LUK with the largest total (all stat % counts toward it); the others are not wanted.
 * - attack and magic attack: only the larger of the two.
 * - every other wanted line as it is (boss damage, crit damage, drop rate …); HP % only when there is no stat line.
 * `rule` narrows the stats that can be the main one to the item's job, or reads the option as a Xenon's (StatRule).
 * Returns null when no line is wanted (the item is still being rolled, or was rolled for something we do not rank).
 */
export function goalOf(option: string[], add: boolean, rule: StatRule = {}): Goal | null {
  const total = new Map<string, number>();
  const lines: [string, number][] = [];
  for (const text of option) {
    const token = optionToken(text);
    lines.push(token ?? [cappedCategory(text), 0]);
    if (token) total.set(token[0], (total.get(token[0]) ?? 0) + token[1]);
  }
  const sum = (cat: string) => total.get(cat) ?? 0;
  // The Xenon reading of somebody else's piece is for all stat alone, on main potential: with a stat line of its own
  // it is not read this way, and additional potential never is — there the reading only widened the stats that
  // count, and a "per 9 levels STR" line on a thief's shoes passed for main stat (Codex review, 2026-11-13).
  if (rule.allOnly && (add || XENON_STATS.some((c) => sum(c) > 0))) return null;
  const best = (cats: readonly string[]) => cats.map((c) => [c, sum(c)] as const).sort((x, y) => y[1] - x[1])[0];

  // The stat this item is for: the largest stat % total, or (additional potential) the "per 9 levels" stat — among
  // the stats of the item's job when its name says one. A line of another job's stat is then no main stat line.
  const pool = rule.stats ?? MAIN_STATS;
  const [topStat, topSum] = best(pool);
  const [topLv, lvSum] = best(pool.map((c) => `lv${c}`));
  // Additional potential also has flat stat lines ("STR +18"): the stat is that one when nothing else names it, so
  // STR +18 · 올스탯 2 % · 공격력 11 is a STR option here as it is on the calculator (Codex review, 2026-11-13).
  const [topFlat, flatSum] = add ? best(pool.map((c) => `f${c}`)) : ["", 0];
  // A Xenon has no one main stat: its stat % lines go into the all stat total below. Main potential only — the
  // additional one mixes flat lines, which are turned into main stat % with the calculator's conversion as before.
  const xenon = rule.xenon === true && !add;
  const statSum = xenon ? 0 : topSum;
  // HP % on a piece that can be a demon avenger's is what such an option is for (below): a flat STR line next to
  // it does not make it a STR option (Codex review, 2026-11-13: HP 11 % + STR +18 read as "STR 1.7 %급").
  const hpGoal = sum("hp") > 0 && (!rule.stats || rule.stats.every((c) => c === "str"));
  const byFlat = !xenon && statSum <= 0 && lvSum <= 0 && flatSum > 0 && !hpGoal;
  const stat = xenon ? "" : statSum > 0 ? topStat : lvSum > 0 ? topLv.slice(2) : byFlat ? topFlat.slice(1) : "";
  // Attack or magic attack: an INT item is a mage's; with no stat line the item's job says (mage gear is magic,
  // other class gear is not), and without one whichever the option has more of.
  const magic = stat ? stat === "int" : rule.stats ? rule.stats.every((c) => c === "int") : sum("matk") + sum("matkf") > sum("atk") + sum("atkf");
  const skip = new Set<string>(magic ? ["atk", "atkf"] : ["matk", "matkf"]);
  for (const c of MAIN_STATS) if (c !== stat) skip.add(`lv${c}`);

  const sums = Object.fromEntries(total);
  const conds: CustomCond[] = [];
  if (xenon && xenonAll(sums) > 0) conds.push({ cat: "all", min: xenonAll(sums) });
  else if (statSum > 0) conds.push({ cat: stat, min: statSum + sum("all") });
  else if (sum("all") > 0) conds.push({ cat: "all", min: sum("all") });
  // HP % is what an item with no stat line at all is for (demon avenger gear): a warrior's piece, or one whose name
  // does not say. On a mage's robe whose LUK line was just left out, HP 10 % is no goal either.
  else if (!stat && hpGoal) conds.push({ cat: "hp", min: sum("hp") });
  // A flat stat line that is all the option has of its stat is what the option is for.
  else if (byFlat) conds.push({ cat: topFlat, min: flatSum });
  for (const cat of add ? WANTED_ADD : WANTED_MAIN) if (sum(cat) > 0 && !skip.has(cat)) conds.push({ cat, min: sum(cat) });
  if (conds.length === 0) return null;
  return { conds, label: conds.map(condLabel).join(" · "), stat, magic, sums, lines, ...(xenon ? { xenon } : {}) };
}

// ── Equipment part → the calculator's slot ──

const SLOT: Record<string, string> = {
  모자: "hat", 상의: "top", 한벌옷: "overall", 하의: "bottom", 신발: "shoes", 장갑: "gloves", 망토: "cape", 벨트: "belt", 어깨장식: "shoulder",
  얼굴장식: "face", 눈장식: "eye", 귀고리: "earring", 반지: "ring", 펜던트: "pendant", 기계심장: "heart", 엠블렘: "emblem",
  무기: "weapon",
  // The soul on a weapon (our own name for the part: the soul history has none).
  소울: "soul",
  // Secondary weapons that are not named "보조무기" by the API.
  보조무기: "sub", 방패: "sub", 포스실드소울링: "sub", 포스실드: "sub", 소울링: "sub", 블레이드: "sub",
};
export const slotOf = (part: string): string | null => SLOT[part.replace(/\s+/g, "")] ?? null;

/** Lines that the main-stat number already covers with this conversion: they are not judged a second time on their own. */
const inStat = (cat: string, stat: string, conv: StatConv) =>
  cat === stat ||
  (cat === "all" && conv.all > 0) ||
  (cat === `lv${stat}` && conv.lvstr > 0) ||
  (cat === `f${stat}` && conv.flat > 0) ||
  (cat === "cd" && conv.cd > 0) ||
  ((cat === "atkf" || cat === "matkf") && conv.atkf > 0);

/**
 * Main stat % the option is worth ("INT 15.8 %급"): its stat % plus all stat %, the "per 9 levels" line, the flat
 * stat line ("INT +14"), crit damage and flat attack turned into stat % with the calculator's conversion (the
 * user's numbers).
 */
export function statWorth(goal: Goal, conv: StatConv): number {
  const sum = (cat: string) => goal.sums[cat] ?? 0;
  // An option with no main stat line of its own (all stat % only) is still worth main stat through the conversion.
  const own = goal.stat ? sum(goal.stat) + sum(`lv${goal.stat}`) * conv.lvstr + sum(`f${goal.stat}`) * conv.flat : 0;
  return own + sum("all") * conv.all + sum("cd") * conv.cd + sum(goal.magic ? "matkf" : "atkf") * conv.atkf;
}

type Row = NonNullable<ReturnType<typeof lineTables>>[number][number];

/**
 * The line tables a roll is judged on. A prime cube keeps line 1 and rerolls the other two, so its line 1 is the one
 * the option has: `rows` with the option's own category names, `std` with the item's main stat renamed to STR — the
 * stand-in the calculator's main stat goals count (another stat's line is then worth nothing).
 * `table` = the cube's tables as they are (top values and line grades are read from these).
 */
function tablesOf(row: Pick<PotRow, "part" | "level" | "meso" | "add" | "type" | "soul">, grade: Grade, goal: Goal) {
  const cube = cubeOf(row as PotRow);
  const slot = slotOf(row.part);
  if (!cube || !slot) return null;
  const table = lineTables(cube, grade, slot, row.level);
  if (!table) return null;
  const [cat, value] = goal.lines[0] ?? ["", 0];
  const prime = (CUBES.find((c) => c.id === cube)?.fixFirst ?? false) && goal.lines.length > 0;
  // An option with no main stat of its own is asked with STR standing in for it ("주스탯 15 %"). A kept line 1 that
  // is a stat line was then left out as another job's (a STR line on a mage's shoes): it must not pass for the
  // stand-in and count again (Codex review, 2026-11-13: that read a 2.6 % roll as 32 %). A Xenon's lines stay.
  const statLine = MAIN_STATS.some((c) => cat === c || cat === `lv${c}` || cat === `f${c}`);
  const kept = !goal.stat && !goal.xenon && statLine ? "" : cat;
  const standIn = !goal.stat
    ? kept
    : cat === goal.stat
      ? "str"
      : cat === `lv${goal.stat}`
        ? "lvstr"
        : cat === `f${goal.stat}`
          ? "fstr"
          : cat === "str" || cat === "lvstr" || cat === "fstr"
            ? ""
            : cat;
  // A Xenon's goal: every STR · DEX · LUK % line is an all stat line of a third its value (a kept line 1 too).
  const fix = (name: string): Row[][] => {
    const rows = prime ? fixFirstLine(table, name, value) : table;
    return goal.xenon ? rows.map((line) => line.map((r): Row => (XENON_STATS.includes(r[0]) ? ["all", r[1] / 3, r[2], r[3]] : r))) : rows;
  };
  return { slot, table, rows: fix(kept), std: fix(standIn), first: prime ? { cat, value } : undefined };
}

/**
 * Chance per roll of an option this good or better, and what "this good" was measured on. Each kind of item is judged
 * the way the calculator's own goals judge it, so the same result gives the same average on both pages:
 * - weapons · secondaries · emblems, main potential: useful lines (attack % · boss damage, and ignore defence when the
 *   option has one) — "유효 3줄". Which of them a line is does not matter: 보공 + 마력 + 방무 is as rare as any other
 *   three useful lines. Judging it by its hardest single line called it a 1-in-18 result (user, 2026-11-12);
 * - weapons, additional potential: the attack % the option adds up to, from the top two values (21 %) up — 12 + 12 is
 *   "공격력 24 %", three lines "30 %" — with "+ @" when the line that is not attack % is a main stat one;
 * - gloves with crit damage, main potential: that many crit damage lines plus the option's main stat % in total;
 *   hats with cooldown: that many seconds of cooldown in total plus the main stat % in total.
 *   The values count, not the number of lines (user, 2026-11-13): STR 12 % is not the 9 % line, and 공 12 + 12 is
 *   not 12 + 9. The calculator's chips still count lines; its "직접" mode gives these numbers;
 * - armour and accessories with a main stat: the option's main stat % — the chance of any option with that much or more.
 *   Main potential is read the way players say it ("INT 30 %": stat % plus all stat %, one for one; user 2026-11-12).
 *   Additional potential mixes flat attack and "per 9 levels" lines, so those are converted: "INT 15.8 %급";
 * - what is left (drop rate, a weapon with no useful line …): the hardest single total of the goal.
 * null when the calculator has no table for this cube · grade · part.
 */
export function goalChance(
  row: Pick<PotRow, "part" | "level" | "meso" | "add" | "type" | "soul">,
  grade: Grade,
  goal: Goal,
  conv: StatConv
): { p: number; by: string } | null {
  const tables = tablesOf(row, grade, goal);
  if (!tables) return null;
  // `rows` · `std` have a prime cube's line 1 fixed to the option's own (see tablesOf); `table` never does.
  const { slot, table, rows, std, first } = tables;
  const info = SLOTS.find((x) => x.id === slot);
  const kind = info?.kind;
  // Attack or magic attack. On a weapon the option's own attack % lines say which: a stray INT line on a warrior's
  // weapon must not turn 공격력 21 % into "INT 9 %". Elsewhere (and on a tie) the item's main stat does.
  const weaponLike = kind === "weapon" || kind === "sub" || kind === "emblem";
  const pct = (cat: string) => goal.sums[cat] ?? 0;
  const magic = (weaponLike || kind === "soul") && pct("atk") !== pct("matk") ? pct("matk") > pct("atk") : goal.magic;
  const attack = magic ? "matk" : "atk";
  const count = (cat: string, min = 0) => goal.lines.filter(([c, v]) => c === cat && v >= min).length;
  // The main stat an option of gloves · hats has next to its crit damage · cooldown, as one total: the stat's own %
  // lines plus all stat % (all stat raises the main stat; user, 2026-11-12).
  // An option with all stat % lines and no main stat line is still a main stat one — 올스탯 27 % on a mage's shoes is
  // "주스탯 27 %", and any option with that much main stat is as good (user, 2026-11-13: read as its own "올스탯 27 %"
  // goal it looked many times rarer than it is). Only for a Xenon is all stat the goal itself (goalOf with the
  // character's job): its STR · DEX · LUK % lines are in the total at a third each, as they are in `rows` (tablesOf).
  const xenon = goal.xenon === true;
  const statCat = goal.stat || (xenon ? "all" : "str");
  const statName = goal.stat ? LABEL[goal.stat] : xenon ? "올스탯" : "주스탯";
  const statTotal = xenon ? xenonAll(goal.sums) : (goal.stat ? pct(goal.stat) : 0) + pct("all");
  const plusStat = statTotal > 0 ? ` + ${statName} ${statTotal}%` : "";
  /** Chance of `special` adding up to `min` or more, together with the main stat total when the option has one. */
  const withStat = (special: string, min: number) => customChance(rows, [[{ cat: special, min }, ...(statTotal > 0 ? [{ cat: statCat, min: statTotal - (xenon ? EPS : 0) }] : [])]]);
  const hit = (p: number, by: string) => (p > 0 ? { p, by } : null);

  if (kind === "soul") {
    // As the calculator's soul goals, by the attack % the option adds up to: from its top two values up, with "+ @"
    // when the other line is one of the soul's good ones (all stat · main stat % · damage · boss damage).
    const need = addWeaponNeed(table, attack);
    const total = pct(attack);
    if (need > 0 && total >= need) {
      const extra = new Set(["all", "dmg", "boss", ...(goal.stat ? [goal.stat] : [])]);
      const rest = goal.lines.filter(([c]) => c !== attack);
      const plus = rest.length > 0 && rest.every(([c]) => extra.has(c));
      return hit(addWeaponSumChance(std, attack, total, plus, SOUL_EXTRA), `${LABEL[attack]} ${total}%${plus ? " + @" : ""}`);
    }
  }

  if (weaponLike) {
    if (row.add) {
      // From the calculator's 21 % (the top two values) up, the option is read by the attack % it adds up to.
      const need = addWeaponNeed(table, attack);
      const total = pct(attack);
      if (need > 0 && total >= need) {
        // "+ @": the line that is not attack % is still a main stat one (the calculator's a21x).
        const extra = new Set(["all", magic ? "matkf" : "atkf", ...(goal.stat ? [goal.stat, `lv${goal.stat}`, `f${goal.stat}`] : [])]);
        const rest = goal.lines.filter(([c]) => c !== attack);
        const plus = rest.length > 0 && rest.every(([c]) => extra.has(c));
        return hit(addWeaponSumChance(std, attack, total, plus), `${LABEL[attack]} ${total}%${plus ? " + @" : ""}`);
      }
    } else {
      const ied = count("ied");
      const useful = count(attack) + count("boss") + ied;
      if (useful > 0) {
        // How good the lines are counts too: 보공 45 · 45 + 공 10 (two lines at the top value) is far rarer than
        // "any three useful lines" (user, 2026-11-12). The option's tier is read with the calculator's own rules,
        // so picking the same chip there gives the same average.
        const tier = weaponTierOf(table, attack, ied > 0, goal.lines);
        const p = weaponChance(table, { attack, ied: ied > 0, min: { a: 0, b: 0, i: 0, v: useful }, tier }, first);
        // Without an ignore defence line the count is of attack % and boss damage only (emblems have no boss line).
        const name = ied > 0 ? "유효" : kind === "emblem" ? LABEL[attack] : `${magic ? "마" : "공"} · 보공`;
        const grade = tier === "v3" ? "" : ` · ${WEAPON_TIERS.find((t) => t.id === tier)!.label}`;
        return hit(p, `${name} ${useful}줄${grade}`);
      }
    }
  }

  if (!row.add && slot === "gloves") {
    // Crit damage lines of 3 % or more, as on the calculator (the 1 % lines do not count).
    const crit = goal.lines.filter(([c, v]) => c === "cd" && v >= 3);
    if (crit.length > 0) return hit(withStat("cd", crit.reduce((sum, [, v]) => sum + v, 0)), `크뎀 ${crit.length}줄${plusStat}`);
  }
  if (!row.add && slot === "hat") {
    const cool = goal.lines.filter(([c]) => c === "cool").map(([, v]) => v);
    if (cool.length > 0) {
      // Cooldown is read by its total seconds, with or without main stat lines: −2초 and −1초 is "쿨감 3초", and
      // only options with 3 seconds or more count as this good. Counting lines called −2초 · −1초 and −2초 · −2초
      // the same thing, and let −1초 · −1초 pass for the first (user, 2026-11-12).
      const seconds = cool.reduce((s, v) => s + v, 0);
      return hit(withStat("cool", seconds), `쿨감 ${seconds}초${plusStat}`);
    }
  }

  let best: { p: number; by: string } | null = null;
  const offer = (p: number, by: string) => {
    if (p > 0 && (!best || p < best.p)) best = { p, by };
  };
  // The conversion the number is made with: none for main potential (all stat one for one).
  const used = row.add ? conv : NO_CONV;
  // An option with all stat % and no main stat line is worth main stat too (user, 2026-11-12 · 13): 크뎀 3 % +
  // 올스탯 6 % on additional gloves is one number, not "크뎀 3 %" alone, and 올스탯 27 % on shoes is "주스탯 27 %".
  // Only a Xenon's main potential keeps it as its own goal ("올스탯 27 %"): that one is asked below, as a condition.
  const byStat = (kind === "armor" || kind === "acc") && !xenon && (goal.stat !== "" || (goal.sums.all ?? 0) > 0);
  if (byStat) {
    // Main potential: the number is the plain one. The chance is still the calculator's — "27 % or more" with its
    // conversion — so the same number gives the same average on both pages.
    const worth = statWorth(goal, used);
    // One decimal, rounded down, and the chance is of that number or more: typing the number shown into the
    // calculator then gives the same average (10.77 shown as "10.8" was 789 rolls here and 876 there; user 2026-11-12).
    const shown = Math.floor(worth * 10 + 1e-6) / 10;
    // "급" only when something other than the stat's own % lines went into the number.
    const pure = goal.stat !== "" && Math.abs(worth - (goal.sums[goal.stat] ?? 0)) < 1e-9;
    offer(sumChance(std, { type: "stat", min: shown - 1e-9, conv, attack }), `${goal.stat ? LABEL[goal.stat] : "주스탯"} ${shown}%${pure || !row.add ? "" : "급"}`);
  }
  // Accessories, main potential: drop rate and meso lines are counted together ("드메 2줄"), as on the calculator.
  const dropLines = !row.add && info?.extra === "drop" ? count("drop") + count("meso") : 0;
  if (dropLines > 0) offer(sumChance(std, { type: "drop", lines: dropLines }), `드메 ${dropLines}줄`);
  const asked = tableConds(goal, row.soul);
  for (const [i, cond] of goal.conds.entries()) {
    if (byStat && inStat(cond.cat, goal.stat, used)) continue;
    if (dropLines > 0 && (cond.cat === "drop" || cond.cat === "meso")) continue;
    offer(customChance(rows, [[asked[i]]]), condLabel(cond));
  }
  return best;
}

/**
 * The goal's conditions as the line tables name them. The soul tables write the main stat as STR only (it stands in
 * for whichever stat the soul gives), so an INT · DEX · LUK condition is asked as STR there: asked by its own name it
 * found the all stat lines alone, and INT 8 % read about 15 times rarer than STR 8 % (Codex review, 2026-11-13).
 */
const tableConds = (goal: Goal, soul: boolean | undefined): CustomCond[] =>
  soul && goal.stat
    ? goal.conds.map((c) => (c.cat === goal.stat ? { ...c, cat: "str" } : c))
    : goal.xenon
      ? // Thirds do not add up exactly (13 ÷ 3 × 3): the total is asked a hair under the number shown.
        goal.conds.map((c) => (c.cat === "all" ? { ...c, min: c.min - EPS } : c))
      : goal.conds;

/**
 * Chance per roll of every wanted total of the goal at once (보공 90 % and 공격력 10 % together). Not an average to
 * show — asking for all of it calls a good option thousands of rolls rare — it only tells apart two options that
 * goalChance() puts in the same class: 보공 45 · 45 + 공 10 and 공 13 + 보공 35 · 35 are both "three useful lines".
 */
export function goalExact(row: Pick<PotRow, "part" | "level" | "meso" | "add" | "type" | "soul">, grade: Grade, goal: Goal): number | null {
  const tables = tablesOf(row, grade, goal);
  const p = tables ? customChance(tables.rows, [tableConds(goal, row.soul)]) : 0;
  return p > 0 ? p : null;
}

/**
 * Chance that this roll takes the item up from `grade`, and the try that is sure to (0 = no guarantee); null when
 * its cube cannot. Miracle time doubles the chance of the rolls made in it — exactly, and only those
 * (the same gradeUp() the calculator uses).
 */
export function upChance(row: PotRow, grade: Grade): { p: number; cap: number } | null {
  const cube = cubeOf(row);
  if (!cube || !NEXT_GRADE[grade]) return null;
  // Cash white cubes use their own grade-up chance (upAlt in the calculator).
  const up = gradeUp(cube, grade, row.mt, cube === "white" && !row.meso);
  return up && up.p > 0 ? up : null;
}

/** Average rolls until the grade goes up at chance `p` a roll, sure at try `cap` (0 = never sure): (1 − (1 − p)^cap) / p. */
export const rollsToUp = (p: number, cap: number) => (cap > 0 ? (1 - (1 - p) ** cap) / p : 1 / p);

/** Average rolls to go up one grade from `grade` with the cube and event of this roll (the guarantee included), or null. */
export function upRolls(row: PotRow, grade: Grade): number | null {
  const up = upChance(row, grade);
  return up ? rollsToUp(up.p, up.cap) : null;
}

// ── Pieces: the API names the item, not the piece ──

export const potKey = (row: Pick<PotRow, "who" | "item" | "add" | "soul">) => `${row.who}\u0000${row.item}\u0000${kindOf(row)}`;
const optionKey = (option: string[]) => option.join("\u0001");

/**
 * Rolls on one item name are split into pieces by following the option: a roll belongs to the piece whose option it
 * starts from. After a batch of rolls the piece either keeps its option or takes one of the batch's results, so the
 * next roll starts from one of those; a roll that fits no piece starts a new one (a second item with the same name,
 * or the same item after something this history does not show changed its option).
 * Returns roll id → piece number (1, 2, …) within potKey, and the rolls whose result was taken.
 */
export type Pieces = { piece: Map<string, number>; taken: Set<string> };

export function trackPieces(rows: PotRow[]): Pieces {
  type Piece = { n: number; now: string; offered: Map<string, string>; batch: number; used: number };
  const pieces = new Map<string, Piece[]>();
  const out = new Map<string, number>();
  const taken = new Set<string>();
  let clock = 0;
  for (const row of [...rows].sort((a, b) => a.t - b.t)) {
    const key = potKey(row);
    let list = pieces.get(key);
    if (!list) pieces.set(key, (list = []));
    const before = optionKey(row.before);
    const recent = [...list].sort((a, b) => b.used - a.used);
    let piece = recent.find((p) => p.now === before);
    if (!piece) {
      piece = recent.find((p) => p.offered.has(before));
      if (piece) {
        taken.add(piece.offered.get(before)!);
        piece.now = before;
        piece.offered = new Map();
      }
    }
    if (!piece) list.push((piece = { n: list.length + 1, now: before, offered: new Map(), batch: row.t, used: 0 }));
    // Results of an earlier batch are gone once a new batch is rolled.
    if (piece.batch !== row.t) {
      piece.offered = new Map();
      piece.batch = row.t;
    }
    const after = optionKey(row.after);
    if (!piece.offered.has(after)) piece.offered.set(after, row.id);
    piece.used = ++clock;
    out.set(row.id, piece.n);
  }
  return { piece: out, taken };
}
