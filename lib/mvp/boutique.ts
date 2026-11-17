// 부티크 기프트 (user, 2026-11-17): bought ten at a time (33,000원 = 10개; the 10th open is a fever one), opened, and the
// 부티크 티켓 sold on the auction house — or sold unopened. Official probability table of the 2026-10-22 ~ 11-18 sale
// (maplestory.nexon.com/Guide/CashShop/Probability/BoutiqueGift).

/** [tickets, % chance] of an ordinary open. */
export const BOUTIQUE_NORMAL: [number, number][] = [
  [1, 49.94], [2, 25.95], [3, 12], [4, 5], [5, 2], [6, 1.5], [7, 1], [8, 0.8], [9, 0.75], [10, 0.7],
  [50, 0.3], [100, 0.03], [500, 0.02], [1000, 0.01],
];
/** Every 10th open of a sale (the count starts over with each sale): at least 10 tickets. */
export const BOUTIQUE_FEVER: [number, number][] = [
  [10, 94.74], [12, 1.5], [14, 1], [16, 0.9], [18, 0.8], [20, 0.7], [100, 0.3], [200, 0.03], [1000, 0.02], [2000, 0.01],
];
/** The rows left out of the usual count (500 tickets and up, 1000 and up on a fever open): about 0.3 % of ten opens. */
const JACKPOT = { normal: 500, fever: 1000 };

/** Open number i (1-based, counted within one sale) is a fever open. */
export const isFever = (i: number) => i % 10 === 0;

const mean = (rows: [number, number][]) => rows.reduce((s, [n, p]) => s + n * p, 0) / rows.reduce((s, [, p]) => s + p, 0);

/**
 * Average tickets from 10 opens (9 ordinary + 1 fever). `withJackpot` false = the average when no jackpot comes up:
 * 30.57 (what players quote as "30.5개", user 2026-11-17 — the page's basis); true = the plain average, 32.76.
 */
export function ticketsPer10(withJackpot = false): number {
  const normal = withJackpot ? BOUTIQUE_NORMAL : BOUTIQUE_NORMAL.filter(([n]) => n < JACKPOT.normal);
  const fever = withJackpot ? BOUTIQUE_FEVER : BOUTIQUE_FEVER.filter(([n]) => n < JACKPOT.fever);
  return 9 * mean(normal) + mean(fever);
}

/** The fewest tickets `n` opens can give: 1 each, 10 on a fever open. */
export const fewestTickets = (n: number) => n + 9 * Math.floor(n / 10);

/**
 * Chances of the total of opens 1 … n, exact, totals of `cap` and more kept together in the last cell.
 * Cost n × 14 × cap (1,000 opens up to 10,000 tickets ≈ 0.1 s).
 */
function totals(n: number, cap: number): Float64Array {
  let d = new Float64Array(cap + 1);
  d[0] = 1;
  for (let i = 1; i <= n; i++) {
    const table = isFever(i) ? BOUTIQUE_FEVER : BOUTIQUE_NORMAL;
    const next = new Float64Array(cap + 1);
    for (let k = 0; k <= cap; k++) {
      const p = d[k];
      if (!p) continue;
      for (const [c, pct] of table) next[Math.min(cap, k + c)] += (p * pct) / 100;
    }
    d = next;
  }
  return d;
}

/** Share (0 ~ 1) of people whose first `n` opens of a sale gave `t` tickets or more. */
export function shareAtLeast(n: number, t: number): number {
  if (t <= 0) return 1;
  return totals(n, t)[t];
}

/** Tickets from `n` opens that a share `top` of people reach or pass (top 0.1 = 상위 10%). */
export function ticketsAtTop(top: number, n = 10): number {
  const d = totals(n, 4000);
  let below = 0;
  for (let k = 0; k < d.length; k++) {
    below += d[k];
    if (below >= 1 - top - 1e-12) return k;
  }
  return d.length - 1;
}
