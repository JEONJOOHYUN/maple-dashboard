// 잠재능력 기록: NEXON Open API history/potential (잠재능력 재설정, meso) and history/cube (cash cubes).
// Shapes checked against real responses on 2026-11-12:
// - one row = one roll. "3회 연속 재설정" arrives as three rows with the same timestamp (the ceiling counter goes up
//   by one on each), all with the same "before" option; the user then keeps the old option or takes one of the three.
// - potential_option_grade / additional_potential_option_grade = the item's grade AFTER the roll;
//   item_upgrade_result "성공" = the roll raised the grade.
// - unlike star force, the rows carry item level and equipment part.
import { CUBES, NEXT_GRADE, NO_CONV, SLOTS, addWeaponChance, addWeaponNeed, customChance, gradeUp, lineTables, resetMeso, sumChance, weaponChance, type CubeId, type CustomCond, type Grade, type StatConv } from "../ev/potential.ts";

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

export function parsePotential(raw: RawPotential): PotRow | null {
  const t = Date.parse(raw.date_create ?? "");
  if (!raw.id || !Number.isFinite(t)) return null;
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

/** 통찰력 level from which the fee is waived: items up to Lv.70 at 60, up to Lv.120 at 90 (user, 2026-11-12; namu.wiki/w/잠재능력 agrees). */
const INSIGHT_FREE_70 = 60;
const INSIGHT_FREE_120 = 90;

/**
 * Meso a cube takes each time it is used ("감정 비용"), by the item's level L and the character's 통찰력:
 * Lv.121 and up 20 L² always · Lv.71~120 2.5 L², free from 통찰력 90 · Lv.31~70 0.25 L², free from 통찰력 60 ·
 * Lv.30 and under free. `insight` = the character's level today (the history has no level of its own), undefined
 * when it is not known: then the fee counts as waived, as it is for most characters that roll cubes.
 * Formula from the user; namu.wiki has 0.5 L² for Lv.31~70 — a few hundred meso a cube either way.
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

/**
 * Meso paid for the roll: the reset's price, or the fee a cube takes (nothing for what is not a cube, e.g. 펄스 인핸서).
 * `insight` = the 통찰력 level of the character that rolled, when known.
 */
export function rollMeso(row: PotRow, insight?: number): number {
  if (row.level <= 0) return 0;
  if (!row.meso) return row.type.includes("큐브") ? cubeFee(row.level, insight) : 0;
  const grade = gradeBefore(row);
  return grade ? (resetMeso(row.add ? "white" : "black", grade, row.level) ?? 0) : 0;
}

// ── Option text → the calculator's category ──

const STAT: Record<string, string> = { STR: "str", DEX: "dex", INT: "int", LUK: "luk" };
const RULES: [RegExp, (m: RegExpMatchArray) => [string, number]][] = [
  [/^(STR|DEX|INT|LUK) \+(\d+)%$/, (m) => [STAT[m[1]], +m[2]]],
  [/^(STR|DEX|INT|LUK) \+(\d+)$/, (m) => [`f${STAT[m[1]]}`, +m[2]]],
  [/^캐릭터 기준 \d+레벨 당 (STR|DEX|INT|LUK) \+(\d+)$/, (m) => [`lv${STAT[m[1]]}`, +m[2]]],
  [/^올스탯 \+(\d+)%$/, (m) => ["all", +m[1]]],
  [/^최대 HP \+(\d+)%$/, (m) => ["hp", +m[1]]],
  [/^최대 MP \+(\d+)%$/, (m) => ["mp", +m[1]]],
  [/^최대 HP \+(\d+)$/, (m) => ["fhp", +m[1]]],
  [/^최대 MP \+(\d+)$/, (m) => ["fmp", +m[1]]],
  [/^공격력 \+(\d+)%$/, (m) => ["atk", +m[1]]],
  [/^마력 \+(\d+)%$/, (m) => ["matk", +m[1]]],
  [/^공격력 \+(\d+)$/, (m) => ["atkf", +m[1]]],
  [/^마력 \+(\d+)$/, (m) => ["matkf", +m[1]]],
  [/^데미지 \+(\d+)%$/, (m) => ["dmg", +m[1]]],
  [/^보스 몬스터.*데미지 \+(\d+)%$/, (m) => ["boss", +m[1]]],
  [/^몬스터 방어율 무시 \+(\d+)%$/, (m) => ["ied", +m[1]]],
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

// ── What the item ended with, as a goal ──

const MAIN_STATS = ["str", "dex", "int", "luk"];
/** Lines that count as "wanted" on top of the main stat. Main potential and additional potential differ. */
const WANTED_MAIN = ["boss", "ied", "atk", "matk", "dmg", "cd", "drop", "meso", "cool"];
const WANTED_ADD = ["boss", "ied", "atk", "matk", "atkf", "matkf", "dmg", "cd", "cool", "lvstr", "lvdex", "lvint", "lvluk"];

/**
 * `stat` = the item's main stat ("" when the option has none), `magic` = magic attack rather than attack,
 * `sums` = every ranked line total by category, `lines` = the option line by line (["", 0] for a line that is not ranked).
 */
export type Goal = { conds: CustomCond[]; label: string; stat: string; magic: boolean; sums: Record<string, number>; lines: [string, number][] };

export const condLabel = (c: CustomCond) => `${LABEL[c.cat] ?? c.cat} ${c.min}${UNIT[c.cat] ?? "%"}`;

const LABEL: Record<string, string> = {
  str: "STR", dex: "DEX", int: "INT", luk: "LUK", hp: "HP", all: "올스탯",
  boss: "보공", ied: "방무", atk: "공격력", matk: "마력", atkf: "공격력 +", matkf: "마력 +", dmg: "데미지", cd: "크뎀",
  drop: "드롭", meso: "메획", cool: "쿨감", lvstr: "9렙당 STR", lvdex: "9렙당 DEX", lvint: "9렙당 INT", lvluk: "9렙당 LUK",
};
const UNIT: Record<string, string> = { cool: "초", atkf: "", matkf: "", lvstr: "", lvdex: "", lvint: "", lvluk: "" };

/**
 * The option an item was left with, read as "this much or more":
 * - main stat = the one of STR · DEX · INT · LUK with the largest total (all stat % counts toward it); the others are not wanted.
 * - attack and magic attack: only the larger of the two.
 * - every other wanted line as it is (boss damage, crit damage, drop rate …); HP % only when there is no stat line.
 * Returns null when no line is wanted (the item is still being rolled, or was rolled for something we do not rank).
 */
export function goalOf(option: string[], add: boolean): Goal | null {
  const total = new Map<string, number>();
  const lines: [string, number][] = [];
  for (const text of option) {
    const token = optionToken(text);
    lines.push(token ?? ["", 0]);
    if (token) total.set(token[0], (total.get(token[0]) ?? 0) + token[1]);
  }
  const sum = (cat: string) => total.get(cat) ?? 0;
  const best = (cats: string[]) => cats.map((c) => [c, sum(c)] as const).sort((x, y) => y[1] - x[1])[0];

  // The stat this item is for: the largest stat % total, or (additional potential) the "per 9 levels" stat.
  const [topStat, statSum] = best(MAIN_STATS);
  const [topLv, lvSum] = best(MAIN_STATS.map((c) => `lv${c}`));
  const stat = statSum > 0 ? topStat : lvSum > 0 ? topLv.slice(2) : "";
  // Attack or magic attack: an INT item is a mage's; with no stat line, whichever the option has more of.
  const magic = stat ? stat === "int" : sum("matk") + sum("matkf") > sum("atk") + sum("atkf");
  const skip = new Set<string>(magic ? ["atk", "atkf"] : ["matk", "matkf"]);
  for (const c of MAIN_STATS) if (c !== stat) skip.add(`lv${c}`);

  const conds: CustomCond[] = [];
  if (statSum > 0) conds.push({ cat: stat, min: statSum + sum("all") });
  else if (sum("all") > 0) conds.push({ cat: "all", min: sum("all") });
  // HP % is what an item with no stat line at all is for (demon avenger gear).
  else if (!stat && sum("hp") > 0) conds.push({ cat: "hp", min: sum("hp") });
  for (const cat of add ? WANTED_ADD : WANTED_MAIN) if (sum(cat) > 0 && !skip.has(cat)) conds.push({ cat, min: sum(cat) });
  if (conds.length === 0) return null;
  return { conds, label: conds.map(condLabel).join(" · "), stat, magic, sums: Object.fromEntries(total), lines };
}

// ── Equipment part → the calculator's slot ──

const SLOT: Record<string, string> = {
  모자: "hat", 상의: "top", 한벌옷: "overall", 하의: "bottom", 신발: "shoes", 장갑: "gloves", 망토: "cape", 벨트: "belt", 어깨장식: "shoulder",
  얼굴장식: "face", 눈장식: "eye", 귀고리: "earring", 반지: "ring", 펜던트: "pendant", 기계심장: "heart", 엠블렘: "emblem",
  // "무기" has not been seen in a real response yet (the 2026-11-12 sample had no weapon roll).
  무기: "weapon",
  // Secondary weapons that are not named "보조무기" by the API.
  보조무기: "sub", 방패: "sub", 포스실드소울링: "sub", 포스실드: "sub", 소울링: "sub", 블레이드: "sub",
};
export const slotOf = (part: string): string | null => SLOT[part.replace(/\s+/g, "")] ?? null;

/** Lines that the main-stat number already covers with this conversion: they are not judged a second time on their own. */
const inStat = (cat: string, stat: string, conv: StatConv) =>
  cat === stat ||
  (cat === "all" && conv.all > 0) ||
  (cat === `lv${stat}` && conv.lvstr > 0) ||
  (cat === "cd" && conv.cd > 0) ||
  ((cat === "atkf" || cat === "matkf") && conv.atkf > 0);

/**
 * Main stat % the option is worth ("INT 15.8 %급"): its stat % plus all stat %, the "per 9 levels" line, crit damage
 * and flat attack turned into stat % with the calculator's conversion (the user's maplescouter numbers).
 */
export function statWorth(goal: Goal, conv: StatConv): number {
  if (!goal.stat) return 0;
  const sum = (cat: string) => goal.sums[cat] ?? 0;
  return sum(goal.stat) + sum("all") * conv.all + sum(`lv${goal.stat}`) * conv.lvstr + sum("cd") * conv.cd + sum(goal.magic ? "matkf" : "atkf") * conv.atkf;
}

/**
 * Chance per roll of an option this good or better, and what "this good" was measured on. Each kind of item is judged
 * the way the calculator's own goals judge it, so the same result gives the same average on both pages:
 * - weapons · secondaries · emblems, main potential: useful lines (attack % · boss damage, and ignore defence when the
 *   option has one) — "유효 3줄". Which of them a line is does not matter: 보공 + 마력 + 방무 is as rare as any other
 *   three useful lines. Judging it by its hardest single line called it a 1-in-18 result (user, 2026-11-12);
 * - weapons, additional potential: attack % adding up to the top two values (21 %), with "+ @" when the third line
 *   is a main stat one, or three attack % lines;
 * - gloves with crit damage · hats with cooldown, main potential: that many special lines plus that many main stat lines;
 * - armour and accessories with a main stat: the option's main stat % — the chance of any option with that much or more.
 *   Main potential is read the way players say it ("INT 30 %": stat % plus all stat %, one for one; user 2026-11-12).
 *   Additional potential mixes flat attack and "per 9 levels" lines, so those are converted: "INT 15.8 %급";
 * - what is left (drop rate, a weapon with no useful line …): the hardest single total of the goal.
 * null when the calculator has no table for this cube · grade · part.
 */
export function goalChance(row: Pick<PotRow, "part" | "level" | "meso" | "add" | "type">, grade: Grade, goal: Goal, conv: StatConv): { p: number; by: string } | null {
  const cube = cubeOf(row as PotRow);
  const slot = slotOf(row.part);
  if (!cube || !slot) return null;
  // Cubes that keep line 1: the chance of the other two lines alone is not worked out here, so no average is given.
  if (CUBES.find((c) => c.id === cube)?.fixFirst) return null;
  const rows = lineTables(cube, grade, slot, row.level);
  if (!rows) return null;
  const info = SLOTS.find((x) => x.id === slot);
  const kind = info?.kind;
  // Attack or magic attack. On a weapon the option's own attack % lines say which: a stray INT line on a warrior's
  // weapon must not turn 공격력 21 % into "INT 9 %". Elsewhere (and on a tie) the item's main stat does.
  const weaponLike = kind === "weapon" || kind === "sub" || kind === "emblem";
  const pct = (cat: string) => goal.sums[cat] ?? 0;
  const magic = weaponLike && pct("atk") !== pct("matk") ? pct("matk") > pct("atk") : goal.magic;
  const attack = magic ? "matk" : "atk";
  const count = (cat: string, min = 0) => goal.lines.filter(([c, v]) => c === cat && v >= min).length;
  const statLines = goal.stat ? count(goal.stat) : 0;
  const plusStat = statLines > 0 ? ` + ${LABEL[goal.stat]} ${statLines}줄` : "";
  const hit = (p: number, by: string) => (p > 0 ? { p, by } : null);

  if (weaponLike) {
    if (row.add) {
      const lines = count(attack);
      const need = addWeaponNeed(rows, attack);
      if (lines === 3) return hit(addWeaponChance(rows, attack, "a3"), `${LABEL[attack]} 3줄`);
      if (need > 0 && (goal.sums[attack] ?? 0) >= need) {
        // "+ @": the line that is not attack % is still a main stat one (the calculator's a21x).
        const extra = new Set(["all", magic ? "matkf" : "atkf", ...(goal.stat ? [goal.stat, `lv${goal.stat}`, `f${goal.stat}`] : [])]);
        const rest = goal.lines.filter(([c]) => c !== attack);
        const withStat = rest.length > 0 && rest.every(([c]) => extra.has(c));
        return hit(addWeaponChance(rows, attack, withStat ? "a21x" : "a21"), `${LABEL[attack]} ${need}%${withStat ? " + @" : ""}`);
      }
    } else {
      const ied = count("ied");
      const useful = count(attack) + count("boss") + ied;
      if (useful > 0) {
        const p = weaponChance(rows, { attack, ied: ied > 0, min: { a: 0, b: 0, i: 0, v: useful }, tier: "v3" });
        // Without an ignore defence line the count is of attack % and boss damage only (emblems have no boss line).
        const name = ied > 0 ? "유효" : kind === "emblem" ? LABEL[attack] : `${magic ? "마" : "공"} · 보공`;
        return hit(p, `${name} ${useful}줄`);
      }
    }
  }

  if (!row.add && slot === "gloves") {
    // Crit damage lines of 3 % or more, as on the calculator (the 1 % lines do not count).
    const crit = count("cd", 3);
    if (crit > 0) return hit(sumChance(rows, { type: "combo", special: "cd", lines: crit, stat: statLines, minSpecial: 3 }), `크뎀 ${crit}줄${plusStat}`);
  }
  if (!row.add && slot === "hat") {
    const cool = goal.lines.filter(([c]) => c === "cool").map(([, v]) => v);
    if (cool.length > 0) {
      const seconds = cool.reduce((s, v) => s + v, 0);
      const name = cool.length === 1 ? `쿨감 ${seconds}초` : `쿨감 ${cool.length}줄`;
      // With no main stat line it is the plain "−n초" goal; with one, cooldown lines of at least the smallest one here.
      if (statLines === 0) return hit(sumChance(rows, { type: "cool", min: seconds }), `쿨감 ${seconds}초`);
      return hit(sumChance(rows, { type: "combo", special: "cool", lines: cool.length, stat: statLines, minSpecial: Math.min(...cool) }), `${name}${plusStat}`);
    }
  }

  let best: { p: number; by: string } | null = null;
  const offer = (p: number, by: string) => {
    if (p > 0 && (!best || p < best.p)) best = { p, by };
  };
  // The conversion the number is made with: none for main potential (all stat one for one).
  const used = row.add ? conv : NO_CONV;
  const byStat = goal.stat !== "" && (kind === "armor" || kind === "acc");
  if (byStat) {
    // Main potential: the number is the plain one. The chance is still the calculator's — "27 % or more" with its
    // conversion — so the same number gives the same average on both pages.
    const worth = statWorth(goal, used);
    // One decimal, rounded down, and the chance is of that number or more: typing the number shown into the
    // calculator then gives the same average (10.77 shown as "10.8" was 789 rolls here and 876 there; user 2026-11-12).
    const shown = Math.floor(worth * 10 + 1e-6) / 10;
    // "급" only when something other than the stat's own % lines went into the number.
    const pure = Math.abs(worth - (goal.sums[goal.stat] ?? 0)) < 1e-9;
    offer(sumChance(rows, { type: "stat", min: shown - 1e-9, conv, attack }), `${LABEL[goal.stat]} ${shown}%${pure || !row.add ? "" : "급"}`);
  }
  // Accessories, main potential: drop rate and meso lines are counted together ("드메 2줄"), as on the calculator.
  const dropLines = !row.add && info?.extra === "drop" ? count("drop") + count("meso") : 0;
  if (dropLines > 0) offer(sumChance(rows, { type: "drop", lines: dropLines }), `드메 ${dropLines}줄`);
  for (const cond of goal.conds) {
    if (byStat && inStat(cond.cat, goal.stat, used)) continue;
    if (dropLines > 0 && (cond.cat === "drop" || cond.cat === "meso")) continue;
    offer(customChance(rows, [[cond]]), condLabel(cond));
  }
  return best;
}

/**
 * Chance per roll of every wanted total of the goal at once (보공 90 % and 공격력 10 % together). Not an average to
 * show — asking for all of it calls a good option thousands of rolls rare — it only tells apart two options that
 * goalChance() puts in the same class: 보공 45 · 45 + 공 10 and 공 13 + 보공 35 · 35 are both "three useful lines".
 */
export function goalExact(row: Pick<PotRow, "part" | "level" | "meso" | "add" | "type">, grade: Grade, goal: Goal): number | null {
  const cube = cubeOf(row as PotRow);
  const slot = slotOf(row.part);
  const rows = cube && slot ? lineTables(cube, grade, slot, row.level) : null;
  const p = rows ? customChance(rows, [goal.conds]) : 0;
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

export const potKey = (row: Pick<PotRow, "who" | "item" | "add">) => `${row.who}\u0000${row.item}\u0000${row.add ? "add" : "main"}`;
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
