// NEXON Open API (MapleStory) — server only. The key is our own (NEXON_API_KEY) and never reaches the browser:
// this module is imported only from server code (app/spec/page.tsx → lib/spec/load.ts).
//
// The key is a service-stage one (user, 2026-11-13): 500 calls a second, so request starts are not spaced.
// A development-stage key (5 a second, 1,000 a day) refuses a burst: a refusal drops this server instance to the
// spaced pace for a minute (2026-11-09 measured: seven calls at once made some fail). It used to last for the
// instance's whole life, which one busy second (a guild search) could set off for good (2026-11-19).
//
// Guild searches fire hundreds of calls (seven a member, lib/spec/guild.ts): those go through nexonGetBulk, which keeps
// this instance to BULK_PER_SEC starts a second so two searches at once stay under the key's 500, and waits out a
// refusal on its own instead of slowing every other caller.
import { DAY, kstDate } from "../enhance/kst.ts";

const BASE = "https://open.api.nexon.com/maplestory/v1";
const SLOW_GAP_MS = 220;
const SLOW_FOR_MS = 60_000;
let slowUntil = 0;
const BULK_PER_SEC = 250;
const BULK_RETRIES = 4;

export type NexonErrorKind = "noKey" | "notFound" | "quota" | "failed";

export class NexonError extends Error {
  readonly kind: NexonErrorKind;
  /** NEXON error code, e.g. OPENAPI00004 (invalid parameter / unknown identifier). */
  readonly code: string;
  constructor(kind: NexonErrorKind, message: string, code = "") {
    super(message);
    this.name = "NexonError";
    this.kind = kind;
    this.code = code;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One queue for every request start (retries included). At the spaced pace each turn waits until SLOW_GAP_MS after
// the previous *actual* start, so a delayed timer cannot release several requests at once (Codex review 2026-11-09).
// Responses still overlap.
let lastStart = 0;
let queue: Promise<void> = Promise.resolve();
function waitTurn(): Promise<void> {
  const turn = queue.then(async () => {
    if (Date.now() < slowUntil) {
      const wait = lastStart + SLOW_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
    }
    lastStart = Date.now();
  });
  queue = turn;
  return turn;
}

// Bulk starts, one line of turns over a token bucket: BULK_PER_SEC a second on average, and at most BULK_BURST (a
// tenth of a second's worth) together — so coarse timers (Windows ticks every ~15 ms) still reach the rate, and
// timers that fire late (a busy server) cannot let a pile of starts out at once: any second holds at most
// BULK_PER_SEC + BULK_BURST starts.
const BULK_BURST = 25;
let bulkTokens = BULK_BURST;
let bulkRefilled = 0;
let bulkQueue: Promise<void> = Promise.resolve();
function bulkTurn(): Promise<void> {
  const turn = bulkQueue.then(async () => {
    for (;;) {
      const now = Date.now();
      bulkTokens = Math.min(BULK_BURST, bulkTokens + ((now - bulkRefilled) * BULK_PER_SEC) / 1000);
      bulkRefilled = now;
      if (bulkTokens >= 1) {
        bulkTokens -= 1;
        return;
      }
      await sleep(Math.ceil(((1 - bulkTokens) * 1000) / BULK_PER_SEC));
    }
  });
  bulkQueue = turn;
  return turn;
}

type Pace = { turn: () => Promise<void>; retries: number; refused: () => void };
const NORMAL: Pace = { turn: waitTurn, retries: 2, refused: () => (slowUntil = Date.now() + SLOW_FOR_MS) };
const BULK: Pace = { turn: bulkTurn, retries: BULK_RETRIES, refused: () => {} };

async function request<T>(path: string, params: Record<string, string>, pace: Pace): Promise<T> {
  const key = process.env.NEXON_API_KEY;
  if (!key) throw new NexonError("noKey", "NEXON_API_KEY is not set");
  const url = `${BASE}/${path}?${new URLSearchParams(params)}`;
  for (let attempt = 0; ; attempt++) {
    await pace.turn();
    const res = await fetch(url, { headers: { "x-nxopen-api-key": key }, cache: "no-store" });
    if (res.ok) return (await res.json()) as T;
    const body = (await res.json().catch(() => null)) as { error?: { name?: string; message?: string } } | null;
    const code = body?.error?.name ?? "";
    if (res.status === 429 || code === "OPENAPI00007") {
      pace.refused();
      if (attempt < pace.retries) {
        // A little spread so the calls refused together do not all come back in the same millisecond.
        await sleep(1100 + Math.random() * 400);
        continue;
      }
      throw new NexonError("quota", `${path}: ${code || res.status}`, code);
    }
    throw new NexonError("failed", `${path}: ${code || res.status} ${body?.error?.message ?? ""}`.trim(), code);
  }
}

/** GET one endpoint, e.g. nexonGet("character/basic", { ocid }). A refusal (429) is retried twice, spaced, before giving up. */
export function nexonGet<T>(path: string, params: Record<string, string>): Promise<T> {
  return request<T>(path, params, NORMAL);
}

/** nexonGet for the many calls of one guild search: paced to BULK_PER_SEC, a refusal waited out and retried. */
export function nexonGetBulk<T>(path: string, params: Record<string, string>): Promise<T> {
  return request<T>(path, params, BULK);
}

/** Character name → ocid. Only an unknown name (400 OPENAPI00004) becomes "notFound"; outages stay "failed" (not cached). */
export async function nexonOcid(name: string, get: typeof nexonGet = nexonGet): Promise<string> {
  try {
    const { ocid } = await get<{ ocid: string }>("id", { character_name: name });
    if (!ocid) throw new NexonError("notFound", name);
    return ocid;
  } catch (e) {
    if (e instanceof NexonError && e.kind === "failed" && e.code === "OPENAPI00004") throw new NexonError("notFound", name, e.code);
    throw e;
  }
}

/**
 * The main of the character's account group: NEXON's union ranking gives every character of one union the same row,
 * named by that union's representative (2026-11-20, 가몽: all 366 members had a row, 122 unions, every representative
 * in the guild the highest level of its union). The ranking is a day behind: yesterday's (KST), or the day before's
 * while yesterday's is still being made (OPENAPI00009, right after midnight). null = no row (no union yet).
 */
export async function nexonUnionMain(ocid: string, get: typeof nexonGet = nexonGet, now = Date.now()): Promise<string | null> {
  for (const date of [kstDate(now - DAY), kstDate(now - 2 * DAY)]) {
    try {
      const r = await get<{ ranking?: { character_name?: string }[] }>("ranking/union", { ocid, date });
      return r.ranking?.[0]?.character_name || null;
    } catch (e) {
      if (!(e instanceof NexonError) || e.kind !== "failed") throw e;
      if (e.code === "OPENAPI00009") continue;
      // No ranking for this character on that day (newer than the ranking): not a failure of the member.
      if (e.code === "OPENAPI00004") return null;
      throw e;
    }
  }
  return null;
}
