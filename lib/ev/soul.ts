// Soul amplification (소울 증폭) with soul ether. Rules checked 2026-11-08;
// not found on Nexon's probability guide (확인 필요).
// Per stage: first chance, + per failure, guaranteed after N failures, meso fee per try (억).
export const SOUL_STAGES = [
  { first: 0.05, step: 0.01, cap: 25, feeEok: 5 },
  { first: 0.03, step: 0.006, cap: 33, feeEok: 10 },
  { first: 0.02, step: 0.004, cap: 43, feeEok: 17.5 },
  { first: 0.015, step: 0.003, cap: 50, feeEok: 27.5 },
] as const;

/** Ether price per stage (억 메소), defaults from the user (2026-11-08). */
export const DEFAULT_ETHER_EOK = [2.1, 3.4, 4.3, 30.4];

/** P(success on try k+1) for one stage, starting after `fails` failures. */
export function stageDist(stage: number, fails = 0): number[] {
  const { first, step, cap } = SOUL_STAGES[stage];
  const out: number[] = [];
  let alive = 1;
  for (let k = fails; k <= cap; k++) {
    const p = k >= cap ? 1 : Math.min(1, first + step * k);
    out.push(alive * p);
    alive *= 1 - p;
    if (alive < 1e-14) break;
  }
  return out;
}

const mean = (d: number[]) => d.reduce((s, q, k) => s + q * (k + 1), 0);

function convolve(a: number[], b: number[]): number[] {
  // a, b: P(N = k + 1). Sum of two such counts: P(N = k + 2) at index k.
  const out = new Array(a.length + b.length).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j + 1] += x * y)));
  return out;
}

export type SoulResult = {
  avgTries: number;
  avgMeso: number;
  /** P(total tries = k + 1). */
  dist: number[];
  /** Average meso per try. */
  perTry: number;
  /** Meso that a share q (0~1) of players stay within; stages cost differently per try, so this is its own distribution. */
  costAt: (q: number) => number;
  stages: { stage: number; avgTries: number }[];
};

/** From stage `now` (0 = not amplified) with `fails` failures already at that stage, up to stage `goal` (1~4). */
export function soulPlan(now: number, goal: number, fails: number, etherEok: number[]): SoulResult {
  const used: number[] = [];
  for (let i = now; i < goal; i++) used.push(i);
  const dists = used.map((i) => stageDist(i, i === now ? Math.min(fails, SOUL_STAGES[i].cap) : 0));
  const avgTries = dists.reduce((s, d) => s + mean(d), 0);
  const avgMeso = dists.reduce((s, d, j) => s + mean(d) * (etherEok[used[j]] + SOUL_STAGES[used[j]].feeEok) * 1e8, 0);
  let dist = [1]; // P(N = 1) = 1 placeholder for "zero stages", fixed below
  if (dists.length === 0) dist = [];
  else {
    dist = dists[0];
    for (const d of dists.slice(1)) dist = convolve(dist, d);
  }
  // Total cost distribution in 0.01억 steps (each stage: tries × that stage's price per try).
  let cost = new Map<number, number>([[0, 1]]);
  dists.forEach((d, j) => {
    const unit = Math.round((etherEok[used[j]] + SOUL_STAGES[used[j]].feeEok) * 100);
    const next = new Map<number, number>();
    for (const [c, p] of cost) d.forEach((q, k) => next.set(c + (k + 1) * unit, (next.get(c + (k + 1) * unit) ?? 0) + p * q));
    cost = next;
  });
  const sorted = [...cost].sort((a, b) => a[0] - b[0]);
  const costAt = (q: number) => {
    let acc = 0;
    for (const [c, p] of sorted) {
      acc += p;
      if (acc >= q - 1e-12) return c * 1e6;
    }
    return (sorted.at(-1)?.[0] ?? 0) * 1e6;
  };
  return {
    avgTries,
    avgMeso,
    costAt,
    dist,
    perTry: avgTries ? avgMeso / avgTries : 0,
    stages: SOUL_STAGES.map((_, i) => ({ stage: i, avgTries: mean(stageDist(i)) })),
  };
}
