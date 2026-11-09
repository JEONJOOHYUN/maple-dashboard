// Potential (잠재능력) expected tries. All chances come from Nexon's probability guide
// (maplestory.nexon.com/Guide/OtherProbability/cube/*, 2026-11-08):
// grade-up chance and guarantee per cube below, option tables per cube · grade · slot · level in data/potential.json.
// Line tables already include the chance of a line being the item's grade or one below.
import data from "./data/potential.json" with { type: "json" };

export type CubeId = "black" | "gold" | "silver" | "prime" | "white" | "primeAddi" | "bronze" | "soul";
export type Grade = "rare" | "epic" | "unique" | "legendary";
export type PotKind = "main" | "add" | "soul";

export const GRADE_LABEL: Record<Grade, string> = { rare: "레어", epic: "에픽", unique: "유니크", legendary: "레전드리" };
export const NEXT_GRADE: Partial<Record<Grade, Grade>> = { rare: "epic", epic: "unique", unique: "legendary" };

export type CubeInfo = {
  id: CubeId;
  name: string;
  alias: string;
  kind: PotKind;
  /** Option table key in data/potential.json (cubes that share a table point to the same key). */
  table: "black" | "gold" | "silver" | "white" | "soul" | null;
  /** [chance, guarantee count (0 = none)] per current grade. Missing = cannot go up from there.
   * The guarantee count is consecutive failures: after N failures the next try goes up (user, 2026-11-09). */
  up: Partial<Record<Grade, [number, number]>>;
  /** Grade-up for the cash cube that shares this entry (white additional cube), when it differs. */
  upAlt?: Partial<Record<Grade, [number, number]>>;
  /** Highest grade this cube can roll. */
  top: Grade;
  /** Prime cubes: legendary items only, line 1 stays as it is and only lines 2 · 3 are rerolled. */
  fixFirst?: boolean;
};

export const CUBES: CubeInfo[] = [
  { id: "black", name: "잠재능력 재설정", alias: "블랙 큐브", kind: "main", table: "black", top: "legendary",
    up: { rare: [0.15, 10], epic: [0.035, 42], unique: [0.014, 107] } },
  // Official black page: prime cubes share the black / white option tables and line-grade chances,
  // work on legendary items only and keep line 1.
  { id: "prime", name: "프라임 큐브", alias: "첫 줄 고정 · 레전드리만", kind: "main", table: "black", top: "legendary", up: {}, fixFirst: true },
  { id: "gold", name: "명장의 큐브", alias: "골드 큐브", kind: "main", table: "gold", top: "legendary",
    up: { rare: [0.079994, 0], epic: [0.016959, 0], unique: [0.001996, 0] } },
  { id: "silver", name: "장인의 큐브", alias: "실버 큐브", kind: "main", table: "silver", top: "unique",
    up: { rare: [0.047619, 0], epic: [0.011858, 0] } },
  // The meso reset and the white additional cube roll the same options, so they are one entry;
  // only the grade-up chance differs (official addi page): up = meso reset, upAlt = white cube.
  { id: "white", name: "에디셔널 잠재능력 재설정", alias: "화이트 에디셔널 큐브와 같음", kind: "add", table: "white", top: "legendary",
    up: { rare: [0.02381, 62], epic: [0.009804, 152], unique: [0.007, 214] },
    upAlt: { rare: [0.047619, 31], epic: [0.019608, 76], unique: [0.007, 214] } },
  { id: "primeAddi", name: "프라임 에디셔널 큐브", alias: "첫 줄 고정 · 레전드리만", kind: "add", table: "white", top: "legendary", up: {}, fixFirst: true },
  { id: "bronze", name: "수상한 에디셔널 큐브", alias: "브론즈 에디셔널 큐브", kind: "add", table: null, top: "epic",
    up: { rare: [0.004, 0] } },
  { id: "soul", name: "소울 잠재능력 재설정", alias: "소울 잠재", kind: "soul", table: "soul", top: "legendary",
    up: { rare: [0.015, 100], epic: [0.005875, 256], unique: [0.003322, 451] } },
];

/**
 * Meso per reset by item level band and the item's grade now (namu.wiki/w/잠재능력 "재설정", checked 2026-11-09;
 * matches its ceiling totals, e.g. rare 10 tries × 450만 = 0.45억 at Lv.200~249).
 * Bands: Lv.250+ · 200~249 · 160~199 · ~159. Grades: rare · epic · unique · legendary.
 */
const RESET_MESO = {
  main: [
    [5_000_000, 20_000_000, 42_500_000, 50_000_000],
    [4_500_000, 18_000_000, 38_250_000, 45_000_000],
    [4_250_000, 17_000_000, 36_125_000, 42_500_000],
    [4_000_000, 16_000_000, 34_000_000, 40_000_000],
  ],
  add: [
    [12_250_000, 34_300_000, 83_300_000, 98_000_000],
    [11_000_000, 30_800_000, 74_800_000, 88_000_000],
    [10_375_000, 29_050_000, 70_550_000, 83_000_000],
    [9_750_000, 27_300_000, 66_300_000, 78_000_000],
  ],
};
/** Soul potential reset, same for every amplification stage (matsu1207.tistory.com/1339, 2026-09-12). */
const SOUL_RESET_MESO = [20_000_000, 40_000_000, 65_000_000, 88_000_000];
const GRADE_INDEX: Record<Grade, number> = { rare: 0, epic: 1, unique: 2, legendary: 3 };

/** Meso for one meso reset (black = 잠재능력 재설정, white = 에디셔널 재설정, soul), or null for cash cubes. */
export function resetMeso(cube: CubeId, grade: Grade, level: number): number | null {
  const g = GRADE_INDEX[grade];
  if (cube === "soul") return SOUL_RESET_MESO[g];
  if (cube !== "black" && cube !== "white") return null;
  const band = level >= 250 ? 0 : level >= 200 ? 1 : level >= 160 ? 2 : 3;
  return RESET_MESO[cube === "black" ? "main" : "add"][band][g];
}

/** Chance that a soul line 2 · 3 has the soul's own grade (line 1 always does). Official soul page. */
export const SOUL_SAME_GRADE: Record<Grade, number> = { rare: 0.019608, epic: 0.047619, unique: 0.019608, legendary: 0.004975 };

export type SlotKind = "weapon" | "sub" | "emblem" | "armor" | "acc" | "soul";
export type SlotExtra = "cool" | "crit" | "drop" | null;
export type Slot = { id: string; label: string; group: "wpn" | "arm" | "acc" | "soul"; kind: SlotKind; extra: SlotExtra; sub: string };

// Slots as on mesu.live + soul. Force shield · soul ring · shield are the same as the secondary weapon.
export const SLOTS: Slot[] = [
  { id: "weapon", label: "무기", group: "wpn", kind: "weapon", extra: null, sub: "공 · 보공 · 방무" },
  { id: "sub", label: "보조무기", group: "wpn", kind: "sub", extra: null, sub: "무기와 같음" },
  { id: "emblem", label: "엠블렘", group: "wpn", kind: "emblem", extra: null, sub: "공 · 방무" },
  { id: "hat", label: "모자", group: "arm", kind: "armor", extra: "cool", sub: "주스탯 · 쿨감" },
  { id: "top", label: "상의", group: "arm", kind: "armor", extra: null, sub: "주스탯" },
  { id: "overall", label: "한벌옷", group: "arm", kind: "armor", extra: null, sub: "주스탯" },
  { id: "bottom", label: "하의", group: "arm", kind: "armor", extra: null, sub: "주스탯" },
  { id: "shoes", label: "신발", group: "arm", kind: "armor", extra: null, sub: "주스탯" },
  { id: "gloves", label: "장갑", group: "arm", kind: "armor", extra: "crit", sub: "주스탯 · 크뎀" },
  { id: "cape", label: "망토", group: "arm", kind: "armor", extra: null, sub: "주스탯" },
  { id: "belt", label: "벨트", group: "arm", kind: "armor", extra: null, sub: "주스탯" },
  { id: "shoulder", label: "어깨장식", group: "arm", kind: "armor", extra: null, sub: "주스탯" },
  { id: "face", label: "얼굴장식", group: "acc", kind: "acc", extra: "drop", sub: "주스탯 · 드메" },
  { id: "eye", label: "눈장식", group: "acc", kind: "acc", extra: "drop", sub: "주스탯 · 드메" },
  { id: "earring", label: "귀고리", group: "acc", kind: "acc", extra: "drop", sub: "주스탯 · 드메" },
  { id: "ring", label: "반지", group: "acc", kind: "acc", extra: "drop", sub: "주스탯 · 드메" },
  { id: "pendant", label: "펜던트", group: "acc", kind: "acc", extra: "drop", sub: "주스탯 · 드메" },
  { id: "heart", label: "기계심장", group: "acc", kind: "acc", extra: null, sub: "주스탯" },
  { id: "soul", label: "소울", group: "soul", kind: "soul", extra: null, sub: "소울 잠재능력" },
];

/** Row: [category, value, chance (0~1), 1 if the line is the item's own grade]. */
type Row = [string, number, number, number];
const DB = data as unknown as { lines: Row[][]; table: Record<string, Record<string, Record<string, Record<string, number[]>>>> };

/** Option tables change between Lv.200 and Lv.201 (e.g. main stat 12 % → 13 %); below 120 is not covered. */
export function levelTier(level: number): "a" | "b" {
  return level >= 201 ? "b" : "a";
}

/** The three line tables for a cube · grade · slot · level, or null when the official guide has none. */
export function lineTables(cube: CubeId, grade: Grade, slot: string, level: number): Row[][] | null {
  const info = CUBES.find((c) => c.id === cube);
  if (!info?.table) return null;
  const g = { legendary: "L", unique: "U", epic: "E", rare: "R" }[grade];
  const byTier = DB.table[info.table]?.[g];
  // Soul tables are keyed by amplification stage (1~4) instead of item level.
  if (info.table === "soul") {
    const ids = byTier?.[`s${Math.min(4, Math.max(1, Math.round(level)))}`]?.soul;
    return ids ? ids.map((i) => DB.lines[i]) : null;
  }
  // Emblems, secondaries etc. do not exist above 200, so fall back to the lower table.
  const ids = byTier?.[levelTier(level)]?.[slot] ?? byTier?.a?.[slot];
  return ids ? ids.map((i) => DB.lines[i]) : null;
}

/** Chance per try of reaching the next grade (and the guarantee), or null when this cube cannot. */
/** Chance per try of going up, and `cap` = the try that is sure to go up (guarantee count + 1), or null. */
export function gradeUp(cube: CubeId, grade: Grade, miracle: boolean, alt = false): { p: number; cap: number } | null {
  const info = CUBES.find((c) => c.id === cube);
  const up = (alt && info?.upAlt ? info.upAlt : info?.up)?.[grade];
  if (!up) return null;
  return { p: Math.min(1, up[0] * (miracle ? 2 : 1)), cap: up[1] ? up[1] + 1 : 0 };
}

/** Rows with line 1 fixed to one option (prime cubes keep line 1). */
export function fixFirstLine(rows: Row[][], cat: string, value: number): Row[][] {
  return [[[cat, value, 1, 1]], rows[1], rows[2]];
}

type Token = { key: string; p: number; cat: string; value: number; own: boolean };

/** Merge rows into tokens (rows that map to the same token add up) plus the "anything else" remainder. */
function tokens(rows: Row[], map: (row: Row) => { cat: string; value: number; own: boolean } | null): Token[] {
  const merged = new Map<string, Token>();
  let used = 0;
  for (const row of rows) {
    const t = map(row);
    if (!t) continue;
    used += row[2];
    const key = `${t.cat}:${t.value}:${t.own ? 1 : 0}`;
    const cur = merged.get(key);
    if (cur) cur.p += row[2];
    else merged.set(key, { key, p: row[2], ...t });
  }
  const list = [...merged.values()];
  list.push({ key: "x", p: Math.max(0, 1 - used), cat: "x", value: 0, own: false });
  return list;
}

/** Exact chance by enumerating the three independent lines. */
function enumerate(lines: Token[][], ok: (a: Token, b: Token, c: Token) => boolean): number {
  let total = 0;
  for (const a of lines[0]) for (const b of lines[1]) for (const c of lines[2]) if (ok(a, b, c)) total += a.p * b.p * c.p;
  return total;
}

export type WeaponGoal = {
  attack: "atk" | "matk";
  /** Count ignore-defense lines as useful. */
  ied: boolean;
  /** Minimum lines of attack % / boss / ignore defense, and useful lines in total. */
  min: { a: number; b: number; i: number; v: number };
  /** Extra rule on top: v3 = none, half = a line 2·3 of the item's grade, one / two = line 2·3 at the top value, all = all three top. */
  tier: "v3" | "half" | "one" | "two" | "all";
};

export function weaponChance(rows: Row[][], goal: WeaponGoal, fixFirst?: "a" | "b" | "i"): number {
  // Top value per category (40 % boss / ignore defense, 12 · 13 % attack) = the highest value in line 1.
  const best: Record<string, number> = {};
  for (const r of rows[0]) best[r[0]] = Math.max(best[r[0]] ?? 0, r[1]);
  if (fixFirst) {
    const cat = fixFirst === "a" ? goal.attack : fixFirst === "b" ? "boss" : "ied";
    rows = fixFirstLine(rows, cat, best[cat] ?? 0);
  }
  const cats = new Set([goal.attack, "boss", "ied"]);
  const lines = rows.map((line) =>
    tokens(line, (r) => (cats.has(r[0]) ? { cat: r[0] === goal.attack ? "a" : r[0] === "boss" ? "b" : "i", value: r[1], own: r[3] === 1 } : null))
  );
  const topOf = { a: best[goal.attack] ?? 0, b: best.boss ?? 0, i: best.ied ?? 0 } as Record<string, number>;
  const useful = (t: Token) => t.cat === "a" || t.cat === "b" || (t.cat === "i" && goal.ied);
  const isTop = (t: Token) => useful(t) && t.value >= topOf[t.cat];
  return enumerate(lines, (x, y, z) => {
    const xs = [x, y, z];
    const n = (c: string) => xs.filter((t) => t.cat === c).length;
    if (n("a") < goal.min.a || n("b") < goal.min.b || n("i") < goal.min.i) return false;
    if (xs.filter(useful).length < goal.min.v) return false;
    const later = [y, z];
    switch (goal.tier) {
      case "half":
        return later.some((t) => useful(t) && t.own);
      case "one":
        return later.some(isTop);
      case "two":
        return later.every(isTop);
      case "all":
        return xs.every(isTop);
      default:
        return true;
    }
  });
}

/**
 * How much one unit of each line is worth in main stat %. Players read these off maplescouter.com
 * ("세부 스펙 효율"); they differ per character, so the page lets people change them.
 */
export type StatConv = { all: number; lvstr: number; atkf: number; cd: number };
/** Main stat % = 1 by definition. */
export const NO_CONV: StatConv = { all: 1, lvstr: 0, atkf: 0, cd: 0 };

/**
 * maplescouter values → StatConv. Its numbers: one "+2 per 9 levels" line = main stat v9 %,
 * crit damage 3 % = main stat cd3 %, attack 1 = atk1 flat main stat, all stat 1 % = all1 flat main stat.
 * Flat main stat turns into % through the 9-level line: (2 × ⌊level / 9⌋) flat = v9 %.
 */
export function convFromScouter(s: { level: number; v9: number; cd3: number; atk1: number; all1: number }): StatConv {
  const flat9 = 2 * Math.floor(s.level / 9);
  const flatPerPct = s.v9 > 0 && flat9 > 0 ? flat9 / s.v9 : 0;
  return {
    all: flatPerPct > 0 ? s.all1 / flatPerPct : 1,
    lvstr: s.v9 / 2,
    atkf: flatPerPct > 0 ? s.atk1 / flatPerPct : 0,
    cd: s.cd3 / 3,
  };
}

export type SumGoal =
  | { type: "stat"; min: number; conv?: StatConv; attack?: "atk" | "matk" }
  | { type: "cool"; min: number }
  | { type: "crit"; lines: number }
  | { type: "drop"; lines: number };

/** Armor · accessories. Main stat = STR % plus other lines turned into main stat % by goal.conv (STR stands in for any main stat). */
export function sumChance(rows: Row[][], goal: SumGoal): number {
  const lines = rows.map((line) =>
    tokens(line, (r) => {
      if (goal.type === "stat") {
        const v = statValue(r, goal.conv ?? NO_CONV, goal.attack ?? "atk");
        return v > 0 ? { cat: "s", value: v, own: false } : null;
      }
      if (goal.type === "cool") return r[0] === "cool" ? { cat: "c", value: r[1], own: false } : null;
      if (goal.type === "crit") return r[0] === "cd" ? { cat: "d", value: r[1], own: false } : null;
      return r[0] === "drop" || r[0] === "meso" ? { cat: "m", value: r[1], own: false } : null;
    })
  );
  return enumerate(lines, (a, b, c) => {
    const xs = [a, b, c];
    if (goal.type === "stat" || goal.type === "cool") return xs.reduce((s, t) => s + (t.cat === "x" ? 0 : t.value), 0) >= goal.min;
    return xs.filter((t) => t.cat !== "x").length >= goal.lines;
  });
}

/** One line's worth in main stat % (0 = not a main stat line). */
function statValue(r: Row, conv: StatConv, attack: "atk" | "matk"): number {
  switch (r[0]) {
    case "str":
      return r[1];
    case "all":
      return r[1] * conv.all;
    case "lvstr":
      return r[1] * conv.lvstr;
    case "cd":
      return r[1] * conv.cd;
    case "atkf":
      return attack === "atk" ? r[1] * conv.atkf : 0;
    case "matkf":
      return attack === "matk" ? r[1] * conv.atkf : 0;
    default:
      return 0;
  }
}

/** Main-stat sum targets for this table: 3 × best, … 3 × second best (e.g. 36 · 33 · 30 · 27 at Lv.200). */
export function statTargets(rows: Row[][]): number[] {
  const vals = [...new Set(rows.flat().filter((r) => r[0] === "str").map((r) => r[1]))].sort((a, b) => b - a);
  if (vals.length === 0) return [];
  const [hi, lo = hi] = vals;
  return [...new Set([lo * 3, hi + lo * 2, hi * 2 + lo, hi * 3])].sort((a, b) => a - b);
}

/** Highest single-line values (for labels). */
export function bestValues(rows: Row[][]): Record<string, number> {
  const best: Record<string, number> = {};
  for (const r of rows.flat()) best[r[0]] = Math.max(best[r[0]] ?? 0, r[1]);
  return best;
}

/** Soul: line 1 always has the soul's grade; lines 2 · 3 each with SOUL_SAME_GRADE. */
export function soulChance(grade: Grade, lines: 2 | 3): number {
  const q = SOUL_SAME_GRADE[grade];
  return lines === 3 ? q * q : 1 - (1 - q) * (1 - q);
}

export type AddWeaponGoal = "a21" | "a21x" | "a3";

/**
 * Additional potential on weapons, the way players aim for it:
 * a21 = attack % adds up to 21 (12 + 9), a21x = 21 % and the other line is "@"
 * (main stat %, all stat %, main stat per 9 levels or flat main stat, flat attack), a3 = three attack % lines.
 * Also used for souls (lineTables("soul", grade, "soul", amplification stage)).
 * STR stands in for any main stat; magic users read 마력 for 공격력.
 */
/** Soul "+@": all stat %, main stat %, damage %, boss damage % (same as mapletiptip.com, user 2026-11-09). */
export const SOUL_EXTRA = ["all", "str", "dmg", "boss"];

export function addWeaponChance(rows: Row[][], attack: "atk" | "matk", goal: AddWeaponGoal, fixFirst = false, extraCats?: string[]): number {
  if (fixFirst) rows = fixFirstLine(rows, attack, Math.max(0, ...rows[0].filter((r) => r[0] === attack).map((r) => r[1])));
  const flat = attack === "atk" ? "atkf" : "matkf";
  // strf = flat main stat (souls).
  const extra = new Set(extraCats ?? ["str", "all", "lvstr", "strf", flat]);
  const values = [...new Set(rows.flat().filter((r) => r[0] === attack).map((r) => r[1]))].sort((a, b) => b - a);
  const need = (values[0] ?? 0) + (values[1] ?? values[0] ?? 0);
  const lines = rows.map((line) =>
    tokens(line, (r) => (r[0] === attack ? { cat: "a", value: r[1], own: false } : extra.has(r[0]) ? { cat: "e", value: 0, own: false } : null))
  );
  return enumerate(lines, (x, y, z) => {
    const xs = [x, y, z];
    const atk = xs.filter((t) => t.cat === "a");
    if (goal === "a3") return atk.length === 3;
    const sum = atk.reduce((s, t) => s + t.value, 0);
    if (sum < need) return false;
    return goal === "a21" || xs.every((t) => t.cat === "a" || t.cat === "e");
  });
}

/** Attack % that "a21" asks for (top value + next one, 12 + 9 = 21 today). */
export function addWeaponNeed(rows: Row[][], attack: "atk" | "matk"): number {
  const values = [...new Set(rows.flat().filter((r) => r[0] === attack).map((r) => r[1]))].sort((a, b) => b - a);
  return (values[0] ?? 0) + (values[1] ?? values[0] ?? 0);
}
