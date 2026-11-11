// Star force expected cost (KMS, after the 2025-03 30-star revamp).
// Source: namu.wiki "메이플스토리/스타포스 강화" (checked 2026-11-08) — success / destroy rates with star catch,
// cost formula, prevention (+200 % of the base cost, no discount) and the restore table. Nexon's probability
// guide has no star force page, so these are the community-documented values. Details: .agents/project-spec.md §4-8.
//
// Rules modelled here
// - A failed try keeps the star (no drops since the revamp). Destroy starts at 15.
// - Destroyed at 15~22: either restore to that star ("확정 복구", N spare items + meso) or go back to 12
//   with one spare item. Destroyed at 23 or more: restore is only sold up to 22, so with restore chosen at 22
//   the item comes back at 22 for the 22-star price; otherwise back to 12
//   (mesu.live source getRestoreTargetStar · starforce.gg numbers, checked 2026-11-11).
// - Prevention ("파괴 방지") only for tries at 15, 16 and 17.
// - Events (starforce.gg notes, 2026-11-08): 30 % off try cost, destroy -30 % only up to the 21→22 try,
//   and Shining Star Force also -20 % on the restore price.

/** Base success rate per current star (0~29), before star catch. */
const SUCCESS = [
  0.95, 0.9, 0.85, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.3, 0.3, 0.15, 0.15, 0.15, 0.3,
  0.15, 0.15, 0.1, 0.1, 0.1, 0.07, 0.05, 0.03, 0.01,
];
/** Base destroy rate per current star, before star catch. */
const DESTROY = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.021, 0.021, 0.068, 0.068, 0.085, 0.105, 0.1275, 0.17, 0.18, 0.18, 0.18,
  0.186, 0.19, 0.194, 0.198,
];
/** Cost divisor for stars 10+ (cost = 1000 + L³·(S+1)^2.7 / divisor). Stars 0~9 use (S+1) / 36 instead. */
const DIVISOR: Record<number, number> = { 10: 571, 11: 314, 12: 214, 13: 157, 14: 107, 15: 200, 16: 200, 17: 150, 18: 70, 19: 45, 20: 200, 21: 125 };
/**
 * Restore ("확정 복구") price per star: spare items needed and meso ≈ k·L³.
 * k fitted from the namu table (140 / 160 / 200 / 250 levels agree within ~1 %).
 */
const RESTORE: Record<number, { items: number; k: number }> = {
  15: { items: 1, k: 54.2 },
  16: { items: 1, k: 130.9 },
  17: { items: 1, k: 220.9 },
  18: { items: 1, k: 501.6 },
  19: { items: 2, k: 831.8 },
  20: { items: 2, k: 1468 },
  21: { items: 3, k: 1843.5 },
  22: { items: 4, k: 3024 },
};

/**
 * Restore meso (억) for stars 15~22 at the item levels that have a published price
 * (namu.wiki table; the same numbers as mesu.live's restoreResourceTable, checked 2026-11-11).
 * Lv.130 · 135 items stop at 20 stars, so they only have 15~19. Other levels use the k·L³ fit above.
 */
const RESTORE_EOK: Record<number, number[]> = {
  130: [1.19, 2.87, 4.85, 11.03, 18.27],
  135: [1.33, 3.21, 5.42, 12.31, 20.43],
  140: [1.48, 3.58, 6.05, 13.74, 22.79, 40.15, 50.45, 82.9],
  145: [1.65, 3.98, 6.71, 15.28, 25.4, 44.5, 56.05, 92.25],
  150: [1.83, 4.41, 7.45, 16.89, 28.03, 49.44, 62.24, 101.79],
  160: [2.22, 5.35, 9.03, 20.5, 34.02, 59.93, 75.31, 123.74],
  200: [4.33, 10.44, 17.64, 40.05, 66.44, 117.06, 147.09, 241.68],
  250: [8.46, 20.39, 34.46, 78.21, 129.77, 228.63, 287.28, 472.04],
};

export const PROTECT_STARS = [15, 16, 17] as const;
export const RESTORE_STARS = [15, 16, 17, 18, 19, 20, 21, 22] as const;
export const FLOOR_STAR = 12;

export type StarEvent = "none" | "sale30" | "destroy30" | "shining";
export type MvpGrade = "none" | "silver" | "gold" | "diamond";

export const MVP_DISCOUNT: Record<MvpGrade, number> = { none: 0, silver: 0.03, gold: 0.05, diamond: 0.1 };
export const PC_DISCOUNT = 0.05;

export type StarOptions = {
  level: number;
  event: StarEvent;
  mvp: MvpGrade;
  pcRoom: boolean;
  starCatch: boolean;
  /** Item-specific cap when it is below the level rule (e.g. 데스티니 무기(2차) = 25). */
  maxStar?: number;
  /** Price of one spare item (메소). Added for every spare used after a destroy. */
  spareMeso: number;
  /** "auto" = pick the cheapest choice per star; otherwise the stars the user chose. */
  protect: "auto" | number[];
  restore: "auto" | number[];
};

export type StarStep = {
  star: number;
  success: number;
  destroy: number;
  tryCost: number;
  protect: boolean;
  restore: boolean;
  /** Expected meso, destroys and tries to go from `star` to `star + 1` (includes climbing back after a destroy). */
  meso: number;
  destroys: number;
  tries: number;
};

/** Highest star an item of this level can reach. */
export function maxStarFor(level: number): number {
  if (level < 95) return 5;
  if (level < 108) return 8;
  if (level < 118) return 10;
  if (level < 128) return 15;
  if (level < 138) return 20;
  return 30;
}

/** Base meso for one try at `star` (before discounts), rounded to the nearest 100 like the game. */
export function baseCost(level: number, star: number): number {
  const l3 = level ** 3;
  const raw = star < 10 ? 1000 + (l3 * (star + 1)) / 36 : 1000 + (l3 * (star + 1) ** 2.7) / (DIVISOR[star] ?? 200);
  return Math.round(raw / 100) * 100;
}

export function restorePrice(level: number, star: number): { items: number; meso: number } | null {
  const r = RESTORE[star];
  if (!r) return null;
  const eok = RESTORE_EOK[level]?.[star - 15];
  return { items: r.items, meso: eok ? eok * 1e8 : r.k * level ** 3 };
}

/** Success and destroy chance for one try (star catch and the event applied). */
export function rates(star: number, opt: Pick<StarOptions, "event" | "starCatch">): { success: number; destroy: number } {
  const p0 = SUCCESS[star];
  const d0 = DESTROY[star];
  const p = opt.starCatch ? Math.min(1, p0 * 1.05) : p0;
  // Star catch takes its extra success out of fail and destroy in proportion.
  let d = p >= 1 ? 0 : (d0 * (1 - p)) / (1 - p0);
  // The destroy cut only applies up to the 21→22 try (starforce.gg: "21성 이하 파괴확률 30% 감소").
  if ((opt.event === "destroy30" || opt.event === "shining") && star <= 21) d *= 0.7;
  return { success: p, destroy: d };
}

function tryCost(star: number, opt: StarOptions): number {
  const base = baseCost(opt.level, star);
  // MVP and PC room only apply up to the 16→17 try; the 30 % sale multiplies on top.
  const flat = star < 17 ? MVP_DISCOUNT[opt.mvp] + (opt.pcRoom ? PC_DISCOUNT : 0) : 0;
  const sale = opt.event === "sale30" || opt.event === "shining" ? 0.7 : 1;
  return base * (1 - flat) * sale;
}

/**
 * Expected values for every step from 0 up to the item's max star.
 * Each step only depends on the steps below it, so choosing the cheapest option per star in order
 * gives the policy with the lowest expected meso overall.
 */
export function starSteps(opt: StarOptions): StarStep[] {
  const max = Math.min(maxStarFor(opt.level), opt.maxStar ?? 30);
  const steps: StarStep[] = [];
  const climb = (from: number, to: number, key: "meso" | "destroys" | "tries") => {
    let sum = 0;
    for (let k = from; k < to; k++) sum += steps[k][key];
    return sum;
  };

  for (let s = 0; s < max; s++) {
    const { success: p, destroy: d } = rates(s, opt);
    const cost = tryCost(s, opt);
    type Choice = { protect: boolean; restore: boolean; meso: number; destroys: number; tries: number };
    const choices: Choice[] = [];

    const canProtect = s >= 15 && s <= 17;
    const canRestore = d > 0 && s in RESTORE;
    const wantProtect = opt.protect === "auto" ? canProtect : canProtect && opt.protect.includes(s);
    const wantRestore = opt.restore === "auto" ? canRestore : canRestore && opt.restore.includes(s);

    if (d === 0) {
      choices.push({ protect: false, restore: false, meso: cost / p, destroys: 0, tries: 1 / p });
    } else {
      // Back to 12 with one spare.
      const back = { meso: climb(FLOOR_STAR, s, "meso"), destroys: climb(FLOOR_STAR, s, "destroys"), tries: climb(FLOOR_STAR, s, "tries") };
      const toFloor: Choice = {
        protect: false,
        restore: false,
        meso: (cost + d * (opt.spareMeso + back.meso)) / p,
        destroys: (d * (1 + back.destroys)) / p,
        tries: (1 + d * back.tries) / p,
      };
      // Shining Star Force also takes 20 % off the restore price (starforce.gg event note).
      const restoreSale = opt.event === "shining" ? 0.8 : 1;
      // Above 22: comes back at 22 when restore is used there (the same trade-off as at 22, so the same choice).
      const r22 = s > 22 && steps[22]?.restore ? restorePrice(opt.level, 22) : null;
      if (r22) {
        choices.push({
          protect: false,
          restore: false,
          meso: (cost + d * (r22.meso * restoreSale + r22.items * opt.spareMeso + climb(22, s, "meso"))) / p,
          destroys: (d * (1 + climb(22, s, "destroys"))) / p,
          tries: (1 + d * climb(22, s, "tries")) / p,
        });
      } else if (opt.restore === "auto" || !wantRestore) choices.push(toFloor);
      if (wantRestore) {
        const r = restorePrice(opt.level, s)!;
        choices.push({
          protect: false,
          restore: true,
          meso: (cost + d * (r.meso * restoreSale + r.items * opt.spareMeso)) / p,
          destroys: d / p,
          tries: 1 / p,
        });
      }
      if (wantProtect) {
        // Prevention adds 200 % of the undiscounted base cost and removes the destroy chance.
        const guarded = cost + 2 * baseCost(opt.level, s);
        const protectedChoice = { protect: true, restore: false, meso: guarded / p, destroys: 0, tries: 1 / p };
        if (opt.protect === "auto") choices.push(protectedChoice);
        else choices.splice(0, choices.length, protectedChoice);
      }
    }
    const best = choices.reduce((a, b) => (b.meso < a.meso ? b : a));
    steps.push({ star: s, success: p, destroy: wantProtect && best.protect ? 0 : d, tryCost: cost, ...best });
  }
  return steps;
}

/** Sum of expected meso / destroys / tries from star `from` to star `to`. */
export function starRange(steps: StarStep[], from: number, to: number) {
  let meso = 0;
  let destroys = 0;
  let tries = 0;
  for (let s = from; s < to && s < steps.length; s++) {
    meso += steps[s].meso;
    destroys += steps[s].destroys;
    tries += steps[s].tries;
  }
  return { meso, destroys, tries };
}
