// NEXON Open API (MapleStory) — server only. The key is our own (NEXON_API_KEY) and never reaches the browser:
// this module is imported only from server code (app/spec/page.tsx → lib/spec/load.ts).
//
// The key is a service-stage one (user, 2026-11-13): 500 calls a second, so request starts are not spaced.
// A development-stage key (5 a second, 1,000 a day) refuses a burst: a refusal drops this server instance to the
// spaced pace for a minute (2026-11-09 measured: seven calls at once made some fail). It used to last for the
// instance's whole life, which one busy second (a guild search) could set off for good (2026-11-19).
//
// Guild searches fire hundreds of calls (seven a member, lib/spec/guild.ts): those go through nexonGetBulk, a line
// of its own at the same rate a tenth of a second at a time (SMOOTH), so two searches at once stay under the key's
// 500 and a refusal there does not slow every other caller. The pace, the line and the retries are ./open-api.ts,
// shared with the other callers.
import { DAY, kstDate } from "../enhance/kst.ts";
import { BASE, FAST, KEY_HEADER, REFUSED_RETRIES, SLOW, SMOOTH, isRefusal, pacer, refusedWait } from "./open-api.ts";

const SLOW_FOR_MS = 60_000;
const BULK_RETRIES = 4;

/** "maintenance" = NEXON is not giving live data now (see MAINTENANCE_CODES): the same call with a date may still answer. */
export type NexonErrorKind = "noKey" | "notFound" | "quota" | "maintenance" | "failed";

// NEXON's "not now" answers (official guide): OPENAPI00009 the data is being prepared, OPENAPI00010 the game is under
// maintenance. OPENAPI00011 (the API itself under maintenance) is not among them: then nothing answers, dated or not.
const MAINTENANCE_CODES = ["OPENAPI00009", "OPENAPI00010"];
// An endpoint that said so for live data is not asked for live data again for this long: one guild search under
// maintenance would otherwise send hundreds of calls only to be told the same. A call with a date is always sent.
const DOWN_FOR_MS = 30_000;
const down = new Map<string, { until: number; code: string }>();

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

// One line for every ordinary request start (retries included). After a refusal it is held to the spaced pace for
// SLOW_FOR_MS: each start then waits for the previous *actual* one, so a delayed timer cannot release several
// requests at once (Codex review 2026-11-09). Responses still overlap.
const ordinary = pacer(FAST);
// The line of the guild searches: at most a tenth of a second's worth together, so coarse timers (Windows ticks
// every ~15 ms) still reach the rate and timers that fire late (a busy server) cannot let a pile of starts out.
const bulk = pacer(SMOOTH);

/** `refused` = NEXON said "too many" to try number `attempt`: the line waits before the next start. */
type Pace = { turn: () => Promise<unknown>; retries: number; refused: (attempt: number) => void };
const NORMAL: Pace = {
  turn: () => ordinary.turn(),
  retries: REFUSED_RETRIES,
  refused(attempt) {
    ordinary.limitTo(SLOW, SLOW_FOR_MS);
    ordinary.backOff(refusedWait(attempt));
  },
};
const BULK: Pace = { turn: () => bulk.turn(), retries: BULK_RETRIES, refused: (attempt) => bulk.backOff(refusedWait(attempt)) };

async function request<T>(path: string, params: Record<string, string>, pace: Pace): Promise<T> {
  const key = process.env.NEXON_API_KEY;
  if (!key) throw new NexonError("noKey", "NEXON_API_KEY is not set");
  const live = !params.date;
  const closed = live ? down.get(path) : undefined;
  if (closed && Date.now() < closed.until) throw new NexonError("maintenance", `${path}: ${closed.code} (not asked again yet)`, closed.code);
  const url = `${BASE}/${path}?${new URLSearchParams(params)}`;
  for (let attempt = 0; ; attempt++) {
    await pace.turn();
    const res = await fetch(url, { headers: { [KEY_HEADER]: key }, cache: "no-store" });
    if (res.ok) return (await res.json()) as T;
    const body = (await res.json().catch(() => null)) as { error?: { name?: string; message?: string } } | null;
    const code = body?.error?.name ?? "";
    if (isRefusal(res.status, code)) {
      // The line is held, so the calls refused together come back one turn at a time.
      pace.refused(attempt);
      if (attempt < pace.retries) continue;
      throw new NexonError("quota", `${path}: ${code || res.status}`, code);
    }
    if (MAINTENANCE_CODES.includes(code)) {
      if (live) down.set(path, { until: Date.now() + DOWN_FOR_MS, code });
      throw new NexonError("maintenance", `${path}: ${code} ${body?.error?.message ?? ""}`.trim(), code);
    }
    throw new NexonError("failed", `${path}: ${code || res.status} ${body?.error?.message ?? ""}`.trim(), code);
  }
}

/** GET one endpoint, e.g. nexonGet("character/basic", { ocid }). A refusal (429) is retried twice, spaced, before giving up. */
export function nexonGet<T>(path: string, params: Record<string, string>): Promise<T> {
  return request<T>(path, params, NORMAL);
}

/** nexonGet for the many calls of one guild search: its own line (SMOOTH), a refusal waited out and retried. */
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
      if (!(e instanceof NexonError) || (e.kind !== "failed" && e.kind !== "maintenance")) throw e;
      if (e.code === "OPENAPI00009") continue;
      // No ranking for this character on that day (newer than the ranking): not a failure of the member.
      if (e.code === "OPENAPI00004") return null;
      throw e;
    }
  }
  return null;
}

/**
 * `live()`, or while NEXON is not giving live data (maintenance), `dated(date)` for the last day it has: every
 * character endpoint also takes a date, and yesterday's data (KST) is there while today's is not — the day before's
 * right after midnight, while yesterday's is still being made. Other failures are thrown as they are.
 */
export async function liveOrYesterday<T>(live: () => Promise<T>, dated: (date: string) => Promise<T>, now = Date.now()): Promise<T> {
  const notNow = (e: unknown) => e instanceof NexonError && e.kind === "maintenance";
  try {
    return await live();
  } catch (e) {
    if (!notNow(e)) throw e;
  }
  try {
    return await dated(kstDate(now - DAY));
  } catch (e) {
    if (!notNow(e)) throw e;
  }
  return dated(kstDate(now - 2 * DAY));
}
