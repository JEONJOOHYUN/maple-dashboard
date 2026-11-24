// The pace of calls made with one NEXON key, kept apart so it can be tested without a clock.

export type Clock = { now: () => number; sleep: (ms: number) => Promise<void> };
const real: Clock = { now: () => Date.now(), sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };

/**
 * Request starts at least `gap` ms apart. Every caller is given the next free start, in the order it asked.
 * `backOff` (after a refusal for pace) moves the next free start later; the starts already given out stay where
 * they are, so a retry never lands between requests that are still waiting.
 */
export function pacer(gap: number, clock: Clock = real) {
  let next = 0;
  return {
    /** Resolves when this caller may start; the value is that moment. */
    async turn(): Promise<number> {
      const now = clock.now();
      const at = Math.max(now, next);
      next = at + gap;
      if (at > now) await clock.sleep(at - now);
      return at;
    },
    backOff(ms: number) {
      next = Math.max(next, clock.now() + ms);
    },
  };
}

/**
 * One pacer per id for as long as it is in use: two requests that call with the same key at once (two tabs, the
 * page and an action) wait in one line instead of each keeping its own pace. A pacer nobody used for `idleMs` is
 * dropped. Per server instance: across instances the retry after a refusal is what holds.
 */
export function pacerPool(gap: number, idleMs: number, clock: Clock = real) {
  const pool = new Map<string, { line: ReturnType<typeof pacer>; used: number }>();
  return (id: string) => {
    const now = clock.now();
    for (const [key, entry] of pool) if (now - entry.used > idleMs) pool.delete(key);
    let entry = pool.get(id);
    if (!entry) pool.set(id, (entry = { line: pacer(gap, clock), used: now }));
    entry.used = now;
    return entry.line;
  };
}

/** The same work asked for again while it is still running is not started twice: both get the one answer. */
export function once<T>(running: Map<string, Promise<unknown>>, key: string, work: () => Promise<T>): Promise<T> {
  const going = running.get(key) as Promise<T> | undefined;
  if (going) return going;
  const mine = work().finally(() => running.delete(key));
  running.set(key, mine);
  return mine;
}
