// Shared "how many tries" helpers for the expected-value calculator tabs.

/** Tries until the first success (geometric). With `cap`, the try at `cap` is guaranteed. */
export function averageTries(p: number, cap = 0): number {
  if (p >= 1) return 1;
  if (p <= 0) return cap > 0 ? cap : Infinity;
  return cap > 0 ? (1 - (1 - p) ** cap) / p : 1 / p;
}

/** Smallest n with P(success within n tries) ≥ q. */
export function triesAt(p: number, q: number, cap = 0): number {
  if (p >= 1) return 1;
  if (p <= 0) return cap > 0 ? cap : Infinity;
  const n = Math.max(1, Math.ceil(Math.log(1 - q) / Math.log(1 - p)));
  return cap > 0 ? Math.min(cap, n) : n;
}

export const LUCK_LEVELS = [
  { label: "운 좋으면 (상위 10%)", q: 0.1 },
  { label: "절반은 (상위 50%)", q: 0.5 },
  { label: "운 나쁘면 (상위 90%)", q: 0.9 },
] as const;

/** Percentile of a discrete distribution given as P(N = k + 1) for k = 0, 1, … */
export function percentileOf(dist: number[], q: number): number {
  let c = 0;
  for (let k = 0; k < dist.length; k++) {
    c += dist[k];
    if (c >= q - 1e-12) return k + 1;
  }
  return dist.length;
}
