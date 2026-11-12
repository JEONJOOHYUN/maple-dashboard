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

type Token = { key: string; p: number; cat: string; value: number; own: boolean; limit?: string };

/**
 * Options that cannot fill all three lines (official cube guide, same rule as mesu.live): "쓸만한" skills and
 * 피격 후 무적시간 at most once, 피격 시 데미지 % 무시 and 피격 시 무적 at most twice. Once the cap is reached the option
 * is left out of the later lines and the rest of that line is scaled up to 100 %.
 */
const LIMIT_CAP: Record<string, number> = { skill: 1, invtime: 1, ignp: 2, inv: 2 };
function limitGroup(cat: string): string | undefined {
  if (cat.startsWith("sk")) return "skill";
  return cat in LIMIT_CAP ? cat : undefined;
}

/** Merge rows into tokens (rows that map to the same token add up) plus the "anything else" remainder. */
function tokens(rows: Row[], map: (row: Row) => { cat: string; value: number; own: boolean } | null): Token[] {
  const merged = new Map<string, Token>();
  let used = 0;
  for (const row of rows) {
    const limit = limitGroup(row[0]);
    // Capped options stay as their own token even when the goal ignores them: they change the later lines.
    const t = map(row) ?? (limit ? { cat: "x", value: 0, own: false } : null);
    if (!t) continue;
    used += row[2];
    const key = `${t.cat}:${t.value}:${t.own ? 1 : 0}:${limit ?? ""}`;
    const cur = merged.get(key);
    if (cur) cur.p += row[2];
    else merged.set(key, { key, p: row[2], ...t, limit });
  }
  const list = [...merged.values()];
  list.push({ key: "x", p: Math.max(0, 1 - used), cat: "x", value: 0, own: false });
  return list;
}

/** Exact chance by enumerating the three independent lines. */
function enumerate(lines: Token[][], ok: (a: Token, b: Token, c: Token) => boolean): number {
  let total = 0;
  if (!lines.some((line) => line.some((t) => t.limit))) {
    for (const a of lines[0]) for (const b of lines[1]) for (const c of lines[2]) if (ok(a, b, c)) total += a.p * b.p * c.p;
    return total;
  }
  // Chance each capped group takes in a line (what is removed from that line once the group is full).
  const share = lines.map((line) => {
    const by: Record<string, number> = {};
    for (const t of line) if (t.limit) by[t.limit] = (by[t.limit] ?? 0) + t.p;
    return by;
  });
  const full = (group: string | undefined, picked: Token[]) => !!group && picked.filter((t) => t.limit === group).length >= LIMIT_CAP[group];
  const scale = (line: number, picked: Token[]) => {
    let removed = 0;
    for (const group of Object.keys(share[line])) if (full(group, picked)) removed += share[line][group];
    return removed < 1 ? 1 / (1 - removed) : 0;
  };
  for (const a of lines[0]) {
    const sb = scale(1, [a]);
    for (const b of lines[1]) {
      if (full(b.limit, [a])) continue;
      const sc = scale(2, [a, b]);
      for (const c of lines[2]) {
        if (full(c.limit, [a, b])) continue;
        if (ok(a, b, c)) total += a.p * b.p * sb * c.p * sc;
      }
    }
  }
  return total;
}

/**
 * Extra rule on top of the useful lines (user's names and meanings, 2026-11-12). "Top value" = the highest value
 * line 1 can have for that option (보공 40 · 45 %, 공 12 · 13 %):
 * v3 = none · half (반이탈) = a line 2 · 3 of the item's own grade · one (꽉이탈 1줄) = a line 2 · 3 at the top value ·
 * two (꽉이탈 2줄) = that, and line 1 at the top value too · all (꽉이탈 3줄) = all three at the top value.
 * Each one contains the next, so they get harder in this order.
 */
export type WeaponTier = "v3" | "half" | "one" | "two" | "all";
export const WEAPON_TIERS: { id: WeaponTier; label: string; desc: string }[] = [
  { id: "v3", label: "유효 3줄", desc: "등급 상관없이 세 줄 모두 유효" },
  { id: "half", label: "반이탈", desc: "유효 3줄 + 2 · 3번째 줄 중 1줄 이상 레전드리 수치" },
  { id: "one", label: "꽉이탈 1줄", desc: "유효 3줄 + 2 · 3번째 줄 중 1줄 이상 최고 수치" },
  { id: "two", label: "꽉이탈 2줄", desc: "꽉이탈 1줄 + 첫 번째 줄도 최고 수치" },
  { id: "all", label: "꽉이탈 3줄", desc: "세 줄 모두 최고 수치" },
];
/** Hardest first: the first one an option meets is its tier. */
const TIERS_HARD_FIRST: WeaponTier[] = ["all", "two", "one", "half"];

/** One line as the tier rules see it: a useful option, at the top value, of the item's own grade. */
type TierLine = { useful: boolean; top: boolean; own: boolean };

function tierMet(tier: WeaponTier, [first, ...later]: TierLine[]): boolean {
  switch (tier) {
    case "half":
      return later.some((l) => l.useful && l.own);
    case "one":
      return later.some((l) => l.top);
    case "two":
      return first.top && later.some((l) => l.top);
    case "all":
      return first.top && later.every((l) => l.top);
    default:
      return true;
  }
}

export type WeaponGoal = {
  attack: "atk" | "matk";
  /** Count ignore-defense lines as useful. */
  ied: boolean;
  /** Minimum lines of attack % / boss / ignore defense, and useful lines in total. */
  min: { a: number; b: number; i: number; v: number };
  tier: WeaponTier;
};

/** Top value per option = the highest value line 1 can have (40 · 45 % boss / ignore defense, 12 · 13 % attack). */
function topValues(rows: Row[][]): Record<string, number> {
  const best: Record<string, number> = {};
  for (const r of rows[0]) best[r[0]] = Math.max(best[r[0]] ?? 0, r[1]);
  return best;
}

/**
 * The tier an option a weapon actually has reaches (the hardest one whose rule it meets), so that its chance can
 * be asked with weaponChance(). `lines` = [category, value] of lines 1 · 2 · 3 in order, categories as in the tables.
 */
export function weaponTierOf(rows: Row[][], attack: "atk" | "matk", ied: boolean, lines: [string, number][]): WeaponTier {
  if (lines.length !== 3 || rows.length < 3) return "v3";
  const best = topValues(rows);
  const seen = lines.map(([cat, value], i): TierLine => {
    const useful = cat === attack || cat === "boss" || (cat === "ied" && ied);
    return { useful, top: useful && value >= (best[cat] ?? Infinity), own: rows[i].some((r) => r[0] === cat && r[1] === value && r[3] === 1) };
  });
  return TIERS_HARD_FIRST.find((tier) => tierMet(tier, seen)) ?? "v3";
}

/**
 * `fixFirst` = a prime cube's kept line 1: "a" · "b" · "i" = attack · boss · ignore defence at its top value (what the
 * calculator offers), or the line an item actually has ({ cat, value } — a line that is not useful counts as none).
 */
export function weaponChance(rows: Row[][], goal: WeaponGoal, fixFirst?: "a" | "b" | "i" | { cat: string; value: number }): number {
  const best = topValues(rows);
  if (typeof fixFirst === "string") {
    const cat = fixFirst === "a" ? goal.attack : fixFirst === "b" ? "boss" : "ied";
    rows = fixFirstLine(rows, cat, best[cat] ?? 0);
  } else if (fixFirst) rows = fixFirstLine(rows, fixFirst.cat, fixFirst.value);
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
    return tierMet(goal.tier, xs.map((t) => ({ useful: useful(t), top: isTop(t), own: t.own })));
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

/**
 * Which line is the main stat: "str" = any single main stat (STR stands in), "all" = Xenon (all stat %),
 * "hp" = Demon Avenger (max HP %). The official table gives all stat / HP their own values and chances
 * (e.g. hat Lv.200 legendary line 1: STR 12 % at 9.76 %, all stat 9 % at 7.32 %, HP 12 % at 9.76 %).
 * For Xenon and Demon Avenger only that line counts; the maplescouter conversions are for single-stat classes.
 */
export type MainStat = "str" | "all" | "hp";

export type SumGoal =
  | { type: "stat"; min: number; conv?: StatConv; attack?: "atk" | "matk"; main?: MainStat }
  | { type: "cool"; min: number }
  | { type: "crit"; lines: number }
  | ComboGoal
  | { type: "drop"; lines: number };

/**
 * Gloves / hats (user, 2026-11-10): at least `lines` lines of the special option (crit damage on gloves, cooldown
 * on hats) of at least `minSpecial` (additional crit damage 1 % lines do not count: 3 % only, user 2026-11-10) plus at
 * least `stat` main stat lines (any value); the rest can be anything.
 * An all stat % line is a main stat line too (user, 2026-11-12: 올스탯 raises the main stat). Xenon (`main: "all"`)
 * and demon avenger (`"hp"`) goals count their own line only.
 */
/**
 * `minSum` (optional) = the special lines' values add up to at least this, e.g. cooldown seconds in total:
 * −2초 and −1초 on two lines is 3 seconds, and "this or better" then leaves out −1초 twice (user, 2026-11-12).
 */
export type ComboGoal = { type: "combo"; special: "cd" | "cool"; lines: number; stat: number; main?: MainStat; minSpecial?: number; minSum?: number };

/**
 * Worked out on the same three-line enumeration as the other goals, so the options that cannot repeat ("쓸만한"
 * skills …) are left out of the later lines here too (Codex review, 2026-11-12: with its own walk over the lines
 * this ignored the cap, and a prime cube that keeps a skill on line 1 read about 16 % rarer than it is).
 */
export function comboChance(rows: Row[][], goal: ComboGoal): number {
  const main = goal.main ?? "str";
  const isStat = (cat: string) => cat === main || (main === "str" && cat === "all");
  const minSpecial = goal.minSpecial ?? 0;
  // Special lines keep their value (a total may be asked of them); main stat lines only count.
  const lines = rows.map((line) =>
    tokens(line, (r) => (r[0] === goal.special && r[1] >= minSpecial ? { cat: "sp", value: r[1], own: false } : isStat(r[0]) ? { cat: "st", value: 0, own: false } : null))
  );
  return enumerate(lines, (a, b, c) => {
    const special = [a, b, c].filter((t) => t.cat === "sp");
    if (special.length < goal.lines) return false;
    if ([a, b, c].filter((t) => t.cat === "st").length < goal.stat) return false;
    return goal.minSum === undefined || special.reduce((sum, t) => sum + t.value, 0) >= goal.minSum;
  });
}

/** Armor · accessories. Main stat = STR % plus other lines turned into main stat % by goal.conv (STR stands in for any main stat). */
export function sumChance(rows: Row[][], goal: SumGoal): number {
  if (goal.type === "combo") return comboChance(rows, goal);
  const lines = rows.map((line) =>
    tokens(line, (r) => {
      if (goal.type === "stat") {
        const main = goal.main ?? "str";
        const v = main === "str" ? statValue(r, goal.conv ?? NO_CONV, goal.attack ?? "atk") : r[0] === main ? r[1] : 0;
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
export function statTargets(rows: Row[][], main: MainStat = "str"): number[] {
  const vals = [...new Set(rows.flat().filter((r) => r[0] === main).map((r) => r[1]))].sort((a, b) => b - a);
  if (vals.length === 0) return [];
  const [hi, lo = hi] = vals;
  return [...new Set([lo * 3, hi + lo * 2, hi * 2 + lo, hi * 3])].sort((a, b) => a - b);
}

/** A line value counts as "realistic" when it shows up at least this often on that line. */
const PRACTICAL_P = 0.01;

/**
 * Target chips (user, 2026-11-10): sums three lines can realistically make — on each line, per counted option, the
 * values seen at least 1 % of the time (crit damage / attack / per-level lines turned into main stat % by the
 * conversion, so gloves count crit damage by efficiency) — highest first, at least `step` apart, `count` of them.
 * e.g. additional armor Lv.200: 20 (8 + 6 + 6) · 18 · 16 · 14 · 12 instead of 18 · 20 · 22 · 24 (22 and 24 need
 * 0.02 % lines); black gloves: 72 · 63 · 52 · 49 · 43 (crit 8 % = 31.7 % main stat) instead of 27 · 30 · 33 · 36.
 */
export function practicalTargets(
  rows: Row[][],
  goal: { conv?: StatConv; attack?: "atk" | "matk"; main?: MainStat },
  step: number,
  count = 5,
): number[] {
  const main = goal.main ?? "str";
  const value = (r: Row) => (main === "str" ? statValue(r, goal.conv ?? NO_CONV, goal.attack ?? "atk") : r[0] === main ? r[1] : 0);
  // Per line: 0 (any other option) plus every counted value seen at least 1 % of the time.
  const options = rows.map((line) => [0, ...new Set(line.filter((r) => r[2] >= PRACTICAL_P).map(value).filter((v) => v > 0))]);
  const sums = new Set<number>();
  const walk = (i: number, acc: number) => {
    if (i === options.length) {
      if (acc > 0) sums.add(Math.floor(acc + 1e-9));
      return;
    }
    for (const v of options[i]) walk(i + 1, acc + v);
  };
  walk(0, 0);
  const picked: number[] = [];
  const sorted = [...sums].sort((x, y) => y - x);
  // Below half the realistic top is a one-line goal (e.g. additional HP 8 %): not worth a chip.
  for (const v of sorted.filter((x) => x >= sorted[0] / 2)) {
    if (picked.length >= count) break;
    if (picked.length === 0 || picked[picked.length - 1] - v >= step) picked.push(v);
  }
  return picked.sort((x, y) => x - y);
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

/**
 * Attack % adding up to `min` or more — what an option a weapon actually has is worth: 12 + 12 is 24 %, rarer than
 * the 21 % of 12 + 9 (user, 2026-11-13). `withExtra` = and every other line is "@", as in "a21x".
 * With `min` = addWeaponNeed() this is addWeaponChance()'s "a21" · "a21x".
 */
export function addWeaponSumChance(rows: Row[][], attack: "atk" | "matk", min: number, withExtra = false): number {
  const extra = new Set(["str", "all", "lvstr", "strf", attack === "atk" ? "atkf" : "matkf"]);
  const lines = rows.map((line) =>
    tokens(line, (r) => (r[0] === attack ? { cat: "a", value: r[1], own: false } : extra.has(r[0]) ? { cat: "e", value: 0, own: false } : null))
  );
  return enumerate(lines, (x, y, z) => {
    const xs = [x, y, z];
    if (xs.reduce((sum, t) => sum + (t.cat === "a" ? t.value : 0), 0) < min) return false;
    return !withExtra || xs.every((t) => t.cat === "a" || t.cat === "e");
  });
}

/** Attack % that "a21" asks for (top value + next one, 12 + 9 = 21 today). */
export function addWeaponNeed(rows: Row[][], attack: "atk" | "matk"): number {
  const values = [...new Set(rows.flat().filter((r) => r[0] === attack).map((r) => r[1]))].sort((a, b) => b - a);
  return (values[0] ?? 0) + (values[1] ?? values[0] ?? 0);
}

// ── Custom goal ("직접"): pick options that exist on the slot, each with a minimum over the three lines. ──

export type OptionGroup = "atk" | "stat" | "flat" | "util" | "etc";
export type OptionInfo = {
  cat: string;
  label: string;
  group: OptionGroup;
  /** "%" · "초" · "" = the values add up over lines; "줄" = the option only counts lines (no single number in the table). */
  unit: "%" | "초" | "" | "줄";
};

export const OPTION_GROUPS: { id: OptionGroup; label: string }[] = [
  { id: "atk", label: "공격" },
  { id: "stat", label: "스탯 %" },
  { id: "flat", label: "스탯 +" },
  { id: "util", label: "사냥 · 편의" },
  { id: "etc", label: "방어 · 회복" },
];

/** Every option in the official cube tables (52 names, checked 2026-11-11), in display order. */
export const OPTIONS: OptionInfo[] = [
  { cat: "boss", label: "보스 데미지", group: "atk", unit: "%" },
  { cat: "ied", label: "방어율 무시", group: "atk", unit: "%" },
  { cat: "atk", label: "공격력 %", group: "atk", unit: "%" },
  { cat: "matk", label: "마력 %", group: "atk", unit: "%" },
  { cat: "dmg", label: "데미지 %", group: "atk", unit: "%" },
  { cat: "crit", label: "크리티컬 확률", group: "atk", unit: "%" },
  { cat: "cd", label: "크리티컬 데미지", group: "atk", unit: "%" },
  { cat: "atkf", label: "공격력 +", group: "atk", unit: "" },
  { cat: "matkf", label: "마력 +", group: "atk", unit: "" },
  { cat: "str", label: "STR %", group: "stat", unit: "%" },
  { cat: "dex", label: "DEX %", group: "stat", unit: "%" },
  { cat: "int", label: "INT %", group: "stat", unit: "%" },
  { cat: "luk", label: "LUK %", group: "stat", unit: "%" },
  { cat: "all", label: "올스탯 %", group: "stat", unit: "%" },
  { cat: "hp", label: "최대 HP %", group: "stat", unit: "%" },
  { cat: "mp", label: "최대 MP %", group: "stat", unit: "%" },
  { cat: "fstr", label: "STR +", group: "flat", unit: "" },
  { cat: "fdex", label: "DEX +", group: "flat", unit: "" },
  { cat: "fint", label: "INT +", group: "flat", unit: "" },
  { cat: "fluk", label: "LUK +", group: "flat", unit: "" },
  { cat: "lvstr", label: "9레벨당 STR", group: "flat", unit: "" },
  { cat: "lvdex", label: "9레벨당 DEX", group: "flat", unit: "" },
  { cat: "lvint", label: "9레벨당 INT", group: "flat", unit: "" },
  { cat: "lvluk", label: "9레벨당 LUK", group: "flat", unit: "" },
  { cat: "fhp", label: "최대 HP +", group: "flat", unit: "" },
  { cat: "fmp", label: "최대 MP +", group: "flat", unit: "" },
  { cat: "drop", label: "아이템 드롭률", group: "util", unit: "%" },
  { cat: "meso", label: "메소 획득량", group: "util", unit: "%" },
  { cat: "cool", label: "쿨타임 감소", group: "util", unit: "초" },
  { cat: "mpcost", label: "MP 소모 감소", group: "util", unit: "%" },
  { cat: "sksharp", label: "쓸만한 샤프 아이즈", group: "util", unit: "줄" },
  { cat: "skwind", label: "쓸만한 윈드 부스터", group: "util", unit: "줄" },
  { cat: "skcombat", label: "쓸만한 컴뱃 오더스", group: "util", unit: "줄" },
  { cat: "skbless", label: "쓸만한 어드밴스드 블레스", group: "util", unit: "줄" },
  { cat: "skhyper", label: "쓸만한 하이퍼 바디", group: "util", unit: "줄" },
  { cat: "skhaste", label: "쓸만한 헤이스트", group: "util", unit: "줄" },
  { cat: "skdoor", label: "쓸만한 미스틱 도어", group: "util", unit: "줄" },
  { cat: "speed", label: "이동속도 +", group: "util", unit: "" },
  { cat: "jump", label: "점프력 +", group: "util", unit: "" },
  { cat: "def", label: "방어력 %", group: "etc", unit: "%" },
  { cat: "fdef", label: "방어력 +", group: "etc", unit: "" },
  { cat: "heal", label: "HP 회복 효율", group: "etc", unit: "%" },
  { cat: "ignp", label: "피격 데미지 % 무시", group: "etc", unit: "줄" },
  { cat: "ignf", label: "피격 데미지 고정 무시", group: "etc", unit: "줄" },
  { cat: "inv", label: "피격 시 무적", group: "etc", unit: "줄" },
  { cat: "invtime", label: "피격 후 무적시간", group: "etc", unit: "초" },
  { cat: "reflect", label: "피해 반사", group: "etc", unit: "줄" },
  { cat: "atkhp", label: "공격 시 HP 회복", group: "etc", unit: "줄" },
  { cat: "atkmp", label: "공격 시 MP 회복", group: "etc", unit: "줄" },
  { cat: "killhp", label: "처치 시 HP 회복", group: "etc", unit: "줄" },
  { cat: "killmp", label: "처치 시 MP 회복", group: "etc", unit: "줄" },
  { cat: "steal", label: "오토스틸", group: "etc", unit: "줄" },
];

export type SlotOption = OptionInfo & {
  /** Totals this option can reach over the three lines, low to high (never 0). */
  sums: number[];
  /** Lowest value of one line of this option itself: where the stepper starts. */
  base: number;
};

/** Options these three line tables can roll, in display order, each with the totals it can reach. */
export function slotOptions(rows: Row[][]): SlotOption[] {
  const perLine = rows.map((line) => {
    const by = new Map<string, Set<number>>();
    for (const r of line) {
      if (!by.has(r[0])) by.set(r[0], new Set());
      by.get(r[0])!.add(r[1]);
    }
    return by;
  });
  return OPTIONS.flatMap((info) => {
    if (!perLine.some((by) => by.has(info.cat))) return [];
    const sums = new Set<number>();
    // An all stat % line also raises each of the four stats.
    const values = (by: Map<string, Set<number>>) => [0, ...(by.get(info.cat) ?? []), ...(ALL_STAT_CATS.has(info.cat) ? by.get("all") ?? [] : [])];
    const [a, b, c] = perLine.map(values);
    // Capped options (e.g. a "쓸만한" skill, once) cannot use more lines than their cap.
    const cap = LIMIT_CAP[limitGroup(info.cat) ?? ""] ?? 3;
    for (const x of a)
      for (const y of b)
        for (const z of c) {
          const used = (x > 0 ? 1 : 0) + (y > 0 ? 1 : 0) + (z > 0 ? 1 : 0);
          if (used > 0 && used <= cap) sums.add(x + y + z);
        }
    const own = perLine.flatMap((by) => [...(by.get(info.cat) ?? [])]);
    return [{ ...info, sums: [...sums].sort((x, y) => x - y), base: Math.min(...own) }];
  });
}

/** STR · DEX · INT · LUK %: all stat % lines count toward each of them (not max HP). */
const ALL_STAT_CATS = new Set(["str", "dex", "int", "luk"]);

/**
 * One wanted option: its values over the three lines add up to `min` or more.
 * Line values are added as shown on the item (ignore defense 30 % + 40 % = 70, not the in-game combined 58 %).
 */
export type CustomCond = { cat: string; min: number };

/**
 * Chance per try that at least one set is met (sets are "or"; the conditions inside a set are "and").
 * Sets without a condition are skipped; no condition at all = 0.
 */
export function customChance(rows: Row[][], sets: CustomCond[][]): number {
  const live = sets.filter((s) => s.length > 0);
  if (!live.length) return 0;
  const cats = new Set(live.flat().map((c) => c.cat));
  if ([...cats].some((c) => ALL_STAT_CATS.has(c))) cats.add("all");
  const lines = rows.map((line) => tokens(line, (r) => (cats.has(r[0]) ? { cat: r[0], value: r[1], own: false } : null)));
  return enumerate(lines, (x, y, z) => {
    const part = (t: Token, cat: string) => (t.cat === cat || (t.cat === "all" && ALL_STAT_CATS.has(cat)) ? t.value : 0);
    const total = (cat: string) => part(x, cat) + part(y, cat) + part(z, cat);
    return live.some((set) => set.every((c) => total(c.cat) >= c.min));
  });
}
