// Calling NEXON Open API (MapleStory): what every caller shares, so the address, the meaning of an error code, the
// pace and the retries are decided in one place. The callers: the browser with a visitor's key (lib/enhance/
// client.ts — 강화 기록 · 보스 수익), the server with our own key (./api.ts — 숨은 스펙업 · 홈 · 썬데이) and the server
// with a member's key (lib/auth/nexon-key.ts, lib/homework/server.ts — 내 정보 · 숙제 현황).
//
// Pace: visitors and members are told to register a service-stage application (user, 2026-11-12), and ours is one,
// so every caller starts at that pace and drops to the development-stage one only after NEXON refuses.

export const BASE = "https://open.api.nexon.com/maplestory/v1";
export const KEY_HEADER = "x-nxopen-api-key";

/** badKey = wrong or revoked key · param = a value NEXON does not take · quota = call limit · busy = not answering now. */
type CodeKind = "badKey" | "param" | "quota" | "busy";
/** NEXON's error codes (official guide). A caller that tells fewer kinds apart folds the rest into its own "failed". */
export const CODE_KINDS: Record<string, CodeKind> = {
  OPENAPI00002: "badKey",
  OPENAPI00003: "param",
  OPENAPI00004: "param",
  OPENAPI00005: "badKey",
  OPENAPI00007: "quota",
  OPENAPI00009: "busy",
  OPENAPI00010: "busy",
  OPENAPI00011: "busy",
};
/** "Too many requests": the per-second limit of the key's stage, or its daily one. */
export const isRefusal = (status: number, code: string) => status === 429 || CODE_KINDS[code] === "quota";

/** At most `burst` request starts in any `windowMs`. */
export type Limit = { burst: number; windowMs: number };
/**
 * Service stage allows 500 request starts a second, counted per application: at most half of that in any one
 * second, so two callers with the same key (two tabs, a page and the server) stay under it together.
 */
const FAST_PER_SECOND = 250;
export const FAST: Limit = { burst: FAST_PER_SECOND, windowMs: 1000 };
/**
 * The same rate a tenth of a second at a time, for the hundreds of calls one request can make on the server (a guild
 * search): a pile of starts never goes out together, however late the timers fire.
 */
export const SMOOTH: Limit = { burst: FAST_PER_SECOND / 10, windowMs: 100 };
/** Development stage allows 5 a second: after a refusal, one request start every this many ms. */
const SLOW_GAP_MS = 230;
export const SLOW: Limit = { burst: 1, windowMs: SLOW_GAP_MS };
/** A refused call is tried this many more times: the per-second limit clears in a second, the daily one does not. */
export const REFUSED_RETRIES = 2;
/** How long the key's line is held before try `attempt + 1`. */
export const refusedWait = (attempt: number) => 1200 * (attempt + 1);

type Clock = { now: () => number; sleep: (ms: number) => Promise<void> };
const real: Clock = { now: () => Date.now(), sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };

/** `work`, or a rejection with the signal's reason the moment the caller gives up (the work itself is left to end). */
function unlessGivenUp<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  return new Promise((resolve, reject) => {
    const stop = () => reject(signal.reason);
    if (signal.aborted) stop();
    else signal.addEventListener("abort", stop, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}

/** NEXON counts by the second: the starts of the last second are remembered whatever the limit is now. */
const REMEMBER_MS = 1000;

/**
 * One line of request starts kept to a limit. Callers take their turn in the order they asked; a turn starts at
 * once while there is room, otherwise a window after the start `burst` places before it. So calls within the limit
 * go together (the characters of an account wait for one answer's time, not for a gap each), and more still keep it.
 * The starts counted are the actual ones, one caller at a time: timers that fire late (a busy server, a tab in the
 * background) cannot let several out together.
 * A caller that gives up (`signal`) is told at once, wherever it stands in the line, and its start is not counted:
 * the callers behind it do not wait for it.
 * `backOff` (after a refusal) holds every later start until then. `limitTo` = another limit from now on (the
 * refusal showed the key's stage), or with `forMs` only for that long: the line then goes back to what it had, for
 * the callers already waiting too. `recent` = how many started in the last `ms`.
 */
export function pacer(limit: Limit, clock: Clock = real) {
  /** The limit the line returns to after a temporary one. */
  let lasting = limit;
  let { burst, windowMs } = limit;
  /** When a temporary limit ends; 0 = none. */
  let until = 0;
  /** The starts of the last `remember` ms, oldest first: enough for any limit the line had or will have. */
  let started: number[] = [];
  let remember = Math.max(REMEMBER_MS, windowMs);
  let held = 0;
  let line: Promise<unknown> = Promise.resolve();
  return {
    /** Resolves when this caller may start; the value is that moment. Rejects with the signal's reason when it gives up. */
    turn(signal?: AbortSignal): Promise<number> {
      const mine = line.then(async () => {
        for (;;) {
          signal?.throwIfAborted();
          const now = clock.now();
          if (until && now >= until) {
            until = 0;
            ({ burst, windowMs } = lasting);
          }
          started = started.filter((at) => now - at < remember);
          const free = Math.max(held, started.length >= burst ? started[started.length - burst] + windowMs : 0);
          if (free <= now) break;
          await unlessGivenUp(clock.sleep(free - now), signal);
        }
        const at = clock.now();
        started.push(at);
        return at;
      });
      // A caller that gave up does not break the line for the ones behind it.
      line = mine.catch(() => {});
      return unlessGivenUp(mine, signal);
    },
    backOff(ms: number) {
      held = Math.max(held, clock.now() + ms);
    },
    limitTo(next: Limit, forMs?: number) {
      ({ burst, windowMs } = next);
      remember = Math.max(remember, windowMs);
      if (forMs === undefined) {
        lasting = next;
        until = 0;
      } else until = clock.now() + forMs;
    },
    recent(ms: number): number {
      const now = clock.now();
      return started.filter((at) => now - at < ms).length;
    },
  };
}
export type Line = ReturnType<typeof pacer>;

/**
 * One line per id for as long as it is in use: two requests that call with the same key at once (two tabs, the
 * page and an action) wait in one line instead of each keeping its own pace. A line nobody used for `idleMs` is
 * dropped. Per server instance: across instances the retry after a refusal is what holds.
 */
export function pacerPool(limit: Limit, idleMs: number, clock: Clock = real) {
  const pool = new Map<string, { line: Line; used: number }>();
  return (id: string) => {
    const now = clock.now();
    for (const [key, entry] of pool) if (now - entry.used > idleMs) pool.delete(key);
    let entry = pool.get(id);
    if (!entry) pool.set(id, (entry = { line: pacer(limit, clock), used: now }));
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
