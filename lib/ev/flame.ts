// Bonus stats (추가옵션) from rebirth flames on boss equipment.
// Official (maplestory.nexon.com/Guide/OtherProbability/game/gameAddOption, 2026-11-08): tier chance per flame,
// boss gear always 4 lines at tier + 2 (3~7), 19 options per slot type picked with equal chance, no repeats.
// Nexon's page gives tier chances and the option list, not values. Values per tier: single stat ⌊L/20⌋+1
// (Lv.250 counts as 220), double stat ⌊L/40⌋+1, attack · magic 1, all stat 1 %, boss damage 2 %, damage 1 %,
// max HP (L with the ones digit dropped)×3 — Lv.160 480, Lv.200 600 and Lv.250 700 a tier (user, 2026-11-13).
// Weapon "%급" (user, 2026-11-08): boss % + damage % + all stat % + main stat 10 = 1 %.

export type FlameId = "strong" | "eternal" | "abyss";

export const FLAMES: { id: FlameId; name: string; tiers: number[] }[] = [
  // Chance of tier 1~5 before the boss +2.
  { id: "strong", name: "강력한 환생의 불꽃", tiers: [0.2, 0.3, 0.36, 0.14, 0] },
  // 영원한 환생의 불꽃 is now the meso reset "추가옵션 재설정" (same tier chances, 300만 메소 a try — user, 2026-11-09).
  { id: "eternal", name: "추가옵션 재설정", tiers: [0, 0.29, 0.45, 0.25, 0.01] },
  { id: "abyss", name: "심연의 환생의 불꽃", tiers: [0, 0, 0.63, 0.34, 0.03] },
];

const POOL = 19;
const LINES = 4;

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}

/** Boss tier (3~7) → chance. */
function bossTiers(flame: FlameId): [number, number][] {
  return FLAMES.find((f) => f.id === flame)!.tiers.map((q, i) => [i + 3, q] as [number, number]).filter(([, q]) => q > 0);
}

/** Highest "n추" this flame can give on a weapon (1추 = tier 7). */
export function bestWeaponGrade(flame: FlameId): number {
  return 8 - Math.max(...bossTiers(flame).map(([t]) => t));
}

/**
 * Weapon: attack (or magic) at "n추" or better, and the other lines worth at least extraPct "%급":
 * boss damage % (2 % per tier) + damage % (1 %) + all stat % (1 %) + main stat ÷ 10 (main-stat single and
 * the three main-stat pairs). Attack and these 6 options are 7 of the 19; STR stands in for any main stat.
 */
export function weaponChance(flame: FlameId, grade: number, extraPct: number, level = 200): number {
  const dist = bossTiers(flame);
  const need = 8 - grade;
  const v = tierValues(level);
  const SCALE = 10; // score in 0.1 % steps
  const others: ((t: number) => number)[] = [
    (t) => 2 * t * SCALE, // boss damage %
    (t) => t * SCALE, // damage %
    (t) => t * SCALE, // all stat %
    (t) => t * v.single, // main stat (÷10 → %, ×10 scale)
    (t) => t * v.double, // main + other stat (three pairs)
    (t) => t * v.double,
    (t) => t * v.double,
  ];
  const R = others.length + 1;
  const total = comb(POOL, LINES);
  let p = 0;
  for (let mask = 0; mask < 1 << others.length; mask++) {
    const picked = others.filter((_, i) => mask & (1 << i));
    if (picked.length > LINES - 1) continue;
    // Attack is always one of the four lines; the rest of the lines come from the 12 unrelated options.
    const pSet = comb(POOL - R, LINES - 1 - picked.length) / total;
    if (pSet === 0) continue;
    let scores = new Map<number, number>([[0, 1]]);
    for (const score of picked) {
      const next = new Map<number, number>();
      for (const [sc, ps] of scores)
        for (const [t, pt] of dist) {
          const k = sc + Math.round(score(t));
          next.set(k, (next.get(k) ?? 0) + ps * pt);
        }
      scores = next;
    }
    const pAtk = dist.filter(([t]) => t >= need).reduce((sum, [, q]) => sum + q, 0);
    for (const [sc, ps] of scores) if (sc >= extraPct * SCALE - 1e-9) p += pSet * pAtk * ps;
  }
  return p;
}

export type ArmorWeights = {
  /** Main-stat jobs: sub stat N = main stat 1, attack 1 = main N, all stat 1 % = main N. */
  sub: number;
  attack: number;
  allStat: number;
};
export const DEFAULT_WEIGHTS: ArmorWeights = { sub: 10, attack: 4, allStat: 10 };
/**
 * Demon Avenger: what attack 1 and STR 1 are worth in max HP. They differ per character, so the page lets people
 * change them. The defaults are one Lv.299 Demon Avenger's (user, 2026-11-13): with them its six Lv.250 armor
 * flames come to 5,171 ~ 5,325 (max HP 4,900 + attack 4 ~ 6, two of them with STR 35) — see the test.
 */
export type HpWeights = { attack: number; str: number };
export const DEFAULT_HP_WEIGHTS: HpWeights = { attack: 67.8, str: 0.51 };
/** A Demon Avenger flame in max HP: the max HP line as it is, attack and STR through the weights. */
export function hpScore(hp: number, attack: number, str: number, hw: HpWeights = DEFAULT_HP_WEIGHTS): number {
  return hp + attack * hw.attack + str * hw.str;
}
/**
 * Xenon: STR · DEX · LUK all count one for one (its damage goes with their sum); attack 1 and all stat 1 % in those
 * points. The middle one of three Xenon characters (user, 2026-11-13): 공마 1당 주스탯 · 올스탯 1%당 주스탯 =
 * 7.28 · 36.8 (Lv.290), 6.28 · 34.7 (Lv.300), 5.1 · 31.5 (Lv.295). (The first values here, 7 and 20, were worked
 * out from the Open API stats alone and had all stat far too low: the equipment list was missing five slots.)
 * They differ per character: the page lets people change them.
 */
export type XenonWeights = { attack: number; allStat: number };
export const DEFAULT_XENON_WEIGHTS: XenonWeights = { attack: 6.28, allStat: 34.7 };
/** "hp" = Demon Avenger: scores are in max HP, and the goal is said as "HP n추 + 공 m" (hpTarget). */
export type FlameJob = "stat" | "hp" | "xenon";

export function tierValues(level: number) {
  return {
    single: Math.floor((level >= 250 ? 220 : level) / 20) + 1,
    double: Math.floor(level / 40) + 1,
    // Lv.250 (에테르넬) counts as 233.33 for max HP: 700 per tier (tier 7 = 4,900).
    hp: level >= 250 ? 700 : Math.floor(level / 10) * 10 * 3,
  };
}

/** Score of one option per boss tier (3~7), for the options that count. */
function relevantOptions(level: number, job: FlameJob, w: ArmorWeights, hw: HpWeights, xw: XenonWeights): ((tier: number) => number)[] {
  const v = tierValues(level);
  if (job === "xenon") {
    return [
      (t) => t * v.single, // STR
      (t) => t * v.single, // DEX
      (t) => t * v.single, // LUK
      (t) => t * v.double * 2, // STR+DEX
      (t) => t * v.double * 2, // STR+LUK
      (t) => t * v.double * 2, // DEX+LUK
      (t) => t * v.double, // STR+INT
      (t) => t * v.double, // DEX+INT
      (t) => t * v.double, // INT+LUK
      (t) => t * xw.attack, // attack
      (t) => t * xw.allStat, // all stat %
    ];
  }
  if (job === "hp") {
    return [
      (t) => t * v.hp, // max HP
      (t) => t * hw.attack, // attack (1 a tier on armor)
      (t) => t * v.single * hw.str, // STR
      (t) => t * v.double * hw.str, // STR+DEX
      (t) => t * v.double * hw.str, // STR+INT
      (t) => t * v.double * hw.str, // STR+LUK
    ];
  }
  // Main = STR, sub = DEX stands in for any job (all four stats are symmetric).
  return [
    (t) => t * v.single, // main
    (t) => (t * v.single) / w.sub, // sub
    (t) => t * v.double * (1 + 1 / w.sub), // main + sub
    (t) => t * v.double, // main + other
    (t) => t * v.double, // main + other
    (t) => (t * v.double) / w.sub, // sub + other
    (t) => (t * v.double) / w.sub, // sub + other
    (t) => t * w.attack, // attack (or magic)
    (t) => t * w.allStat, // all stat %
  ];
}

/**
 * Demon Avenger's goal the way players say it (user, 2026-11-13): "HP n추 + 공 m" = max HP at n추 (1추 = tier 7,
 * 4,200 at Lv.200) plus attack m, in max HP through the person's own conversion. Any roll worth as much counts —
 * a lower HP line with more attack or STR too.
 */
export function hpTarget(level: number, grade: number, attack: number, hw: HpWeights = DEFAULT_HP_WEIGHTS): number {
  return hpScore(tierValues(level).hp * (8 - grade), attack, 0, hw);
}

/** Armor scores are worked out in 0.01 steps. */
const SCALE = 100;

/** Chance of every converted score one roll can give (keys in SCALE steps), over all the ways the four lines fall. */
function scoreChances(flame: FlameId, level: number, job: FlameJob, w: ArmorWeights, hw: HpWeights, xw: XenonWeights): Map<number, number> {
  const dist = bossTiers(flame);
  const options = relevantOptions(level, job, w, hw, xw);
  const R = options.length;
  const total = comb(POOL, LINES);
  const out = new Map<number, number>();
  for (let mask = 0; mask < 1 << R; mask++) {
    const picked = options.filter((_, i) => mask & (1 << i));
    if (picked.length > LINES) continue;
    const pSet = comb(POOL - R, LINES - picked.length) / total;
    if (pSet === 0) continue;
    // Distribution of the summed score over the picked options' tiers.
    let scores = new Map<number, number>([[0, 1]]);
    for (const score of picked) {
      const next = new Map<number, number>();
      for (const [s, ps] of scores)
        for (const [t, pt] of dist) {
          const k = s + Math.round(score(t) * SCALE);
          next.set(k, (next.get(k) ?? 0) + ps * pt);
        }
      scores = next;
    }
    for (const [s, ps] of scores) out.set(s, (out.get(s) ?? 0) + pSet * ps);
  }
  return out;
}

/** Chance that the score reaches x, for any x, from scoreChances(). */
function atLeast(chances: Map<number, number>): (x: number) => number {
  const scores = [...chances].sort((a, b) => a[0] - b[0]);
  const suffix = new Array<number>(scores.length + 1).fill(0);
  for (let i = scores.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + scores[i][1];
  return (x) => {
    // The target in the same steps as the scores: a goal worked out from the weights (hpTarget with attack 1 = HP
    // 90.123) is then met by the roll it stands for, instead of missing it by the rounding (Codex review, 2026-11-13).
    const need = Math.round(x * SCALE);
    let lo = 0;
    let hi = scores.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (scores[mid][0] >= need) hi = mid;
      else lo = mid + 1;
    }
    return suffix[lo];
  };
}

/** Armor · accessories: chance that the converted score reaches `target` (급, or max HP for Demon Avenger). */
export function armorChance(
  flame: FlameId,
  level: number,
  target: number,
  job: FlameJob = "stat",
  w: ArmorWeights = DEFAULT_WEIGHTS,
  hw: HpWeights = DEFAULT_HP_WEIGHTS,
  xw: XenonWeights = DEFAULT_XENON_WEIGHTS
): number {
  return atLeast(scoreChances(flame, level, job, w, hw, xw))(target);
}

/** Goal chips at Lv.200 per job; every level gets chips just as hard to roll as these. */
const CHIPS_200: Record<"stat" | "xenon", number[]> = { stat: [100, 120, 140, 160], xenon: [260, 300, 340, 380] };

/**
 * Goal chips for an item level (user, 2026-11-14: the same chips at every level said little — 160급 at Lv.160 is a
 * 7,000-reset goal, at Lv.250 a 270-reset one). A chip stands for how likely its goal is with one meso reset at the
 * default weights: at each level it is the round 10 whose chance is nearest that chip's at Lv.200 (by ratio, the
 * higher one on a tie). They change only where the tier values do, so they come in level bands — main stat Lv.160
 * 90 · 110 · 120 · 140, Lv.200 100 · 120 · 140 · 160, Lv.250 110 · 130 · 150 · 170; Xenon Lv.160 250 · 280 · 320 ·
 * 350, Lv.200 260 · 300 · 340 · 380, Lv.250 270 · 320 · 360 · 400 (all stat % is worth the same at every level, so
 * Xenon's move less).
 */
export function goalChips(job: "stat" | "xenon", level: number): number[] {
  const at = (L: number) => atLeast(scoreChances("eternal", L, job, DEFAULT_WEIGHTS, DEFAULT_HP_WEIGHTS, DEFAULT_XENON_WEIGHTS));
  const ref = at(200);
  const here = level === 200 ? ref : at(level);
  const chips: number[] = [];
  for (const x of CHIPS_200[job]) {
    const want = ref(x);
    let best = 10;
    let gap = Infinity;
    for (let v = 10; v <= 2000; v += 10) {
      const p = here(v);
      if (p <= 0) break;
      const d = Math.abs(Math.log(p / want));
      if (d <= gap) {
        gap = d;
        best = v;
      }
    }
    // Never two chips the same (only on items too low for flames to reach these goals).
    chips.push(Math.max(best, (chips.at(-1) ?? 0) + 10));
  }
  return chips;
}
