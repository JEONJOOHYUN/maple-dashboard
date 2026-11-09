// Bonus stats (추가옵션) from rebirth flames on boss equipment.
// Official (maplestory.nexon.com/Guide/OtherProbability/game/gameAddOption, 2026-11-08): tier chance per flame,
// boss gear always 4 lines at tier + 2 (3~7), 19 options per slot type picked with equal chance, no repeats.
// Nexon's page gives tier chances and the option list, not values; values per tier are namu.wiki's formulas
// (namu.wiki/w/추가옵션, checked 2026-11-09): single stat ⌊L/20⌋+1 (Lv.250 counts as 220), double stat ⌊L/40⌋+1,
// attack · magic 1, all stat 1 %, boss damage 2 %, damage 1 %, max HP (L with the ones digit dropped)×3.
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
export type HpWeights = { attack: number; str: number };
export const DEFAULT_WEIGHTS: ArmorWeights = { sub: 10, attack: 4, allStat: 10 };
/** Demon Avenger (HP): guesses fitted to maplescouter totals of Lv.250 gear (spec §4-8, 확인 필요). */
export const DEFAULT_HP_WEIGHTS: HpWeights = { attack: 90, str: 1 };

export function tierValues(level: number) {
  return {
    single: Math.floor((level >= 250 ? 220 : level) / 20) + 1,
    double: Math.floor(level / 40) + 1,
    hp: Math.floor(level / 10) * 10 * 3,
  };
}

/** Score of one option per boss tier (3~7), for the options that count. */
function relevantOptions(level: number, job: "stat" | "hp", w: ArmorWeights, hw: HpWeights): ((tier: number) => number)[] {
  const v = tierValues(level);
  if (job === "hp") {
    return [
      (t) => t * v.hp, // max HP
      (t) => t * hw.attack, // attack
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

/** Armor · accessories: chance that the converted score reaches `target` (급, or HP for Demon Avenger). */
export function armorChance(
  flame: FlameId,
  level: number,
  target: number,
  job: "stat" | "hp" = "stat",
  w: ArmorWeights = DEFAULT_WEIGHTS,
  hw: HpWeights = DEFAULT_HP_WEIGHTS
): number {
  const dist = bossTiers(flame);
  const options = relevantOptions(level, job, w, hw);
  const R = options.length;
  const total = comb(POOL, LINES);
  const SCALE = 100; // scores to 0.01 steps
  let p = 0;
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
    for (const [s, ps] of scores) if (s >= target * SCALE - 1e-9) p += pSet * ps;
  }
  return p;
}
