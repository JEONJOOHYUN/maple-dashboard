// A member's homework, read on the server: the keys kept for the member are opened here and never leave it.
// NEXON is asked with the member's own key (the scheduler only answers for the key owner's characters). Members are
// told to register a service-stage key, so the characters are asked together; a key that refuses that (a
// development-stage one: 5 calls a second, 1,000 a day) is asked one at a time from then on (lib/nexon/open-api.ts).
// Every answer is kept: the scheduler per character for a few minutes (picking one more character costs one call),
// the character list per account for an hour.
import "server-only";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { openKey } from "@/lib/auth/key-crypto";
import { ask, type KeyProblem } from "@/lib/auth/nexon-key";
import { unpackLabel } from "@/lib/auth/rules";
import type { RawCharacterList } from "@/lib/enhance/client";
import { kstStamp } from "@/lib/enhance/kst";
import { untilReset } from "@/lib/revenue/calc";
import { MAX_PICKED } from "@/lib/revenue/data";
import { FAST, REFUSED_RETRIES, SLOW, once, pacerPool, refusedWait } from "@/lib/nexon/open-api";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { accountHomework, charHomework, leftChips, mergeShared, summarize, untilDailyReset, type AccountHomework, type CharHomework, type HomeworkState } from "./model";
import { PICK_COOKIE, cleanPick } from "./pick";

/** Without a pick of the member's own: the highest characters of each account (one call each). */
export const PER_ACCOUNT = 12;
/** How long a character's scheduler is kept. */
const KEEP_MS = 5 * 60_000;
/**
 * How long an account's character list is kept. It rarely changes, and every scheduler call waits for it: asked
 * for again each time the schedulers ran out, it put one answer's time before all of them.
 */
const LIST_KEEP_MS = 60 * 60_000;

/** locked = the kept key does not open (another secret, or the row was changed). */
export type AccountProblem = KeyProblem | "locked";
/** A character as NEXON lists it. */
export type Listed = { ocid: string; name: string; world: string; job: string; level: number };
export type CharView = Listed & { hw: CharHomework; /** Weekly boss clears and their limit, as the game counts them. */ clears: number; limit: number };
export type AccountView = {
  id: number;
  /** The account's main character when it was connected ("" = an account without characters). */
  name: string;
  problem?: AccountProblem;
  /** The characters on show: the member's pick, or the highest ones that have homework. */
  chars: CharView[];
  shared: AccountHomework;
  /** How many of the characters asked did not answer. */
  failed: number;
  /** When the oldest answer shown was asked for (ms); 0 = nothing was. */
  at: number;
};

export const homeworkTag = (memberId: string) => `homework:${memberId}`;

/** The characters picked in this browser (lib/homework/pick.ts); none = the automatic choice. */
export async function pickedHere(): Promise<string[]> {
  return cleanPick((await cookies()).get(PICK_COOKIE)?.value, MAX_PICKED);
}

/** One line of request starts per connected account (and key version), shared by every request this instance serves. */
const lineOf = pacerPool(FAST, 10 * 60_000);
/** The lines whose key refused the fast pace. Kept apart from the pool: an idle line is dropped, what was learnt is not. */
const slowLines = new Set<string>();
/** The line of one connected account (and key version), at the pace its key takes. */
function lineFor(id: string) {
  const line = lineOf(id);
  if (slowLines.has(id)) line.limitTo(SLOW);
  return {
    turn: line.turn,
    /** NEXON said "too many": the development-stage pace from here on, after the limit's second has passed. */
    refused(waitMs: number) {
      slowLines.add(id);
      line.limitTo(SLOW);
      line.backOff(waitMs);
    },
  };
}
/** Reads that are under way, so the same character asked for by two requests at once is one call. */
const reading = new Map<string, Promise<unknown>>();

/** `ask` for one key, its request starts kept to the limit (lib/nexon/open-api.ts), a refusal for pace tried again. */
function paced(key: string, line: ReturnType<typeof lineFor>) {
  return async function get<T>(path: string, params?: Record<string, string>) {
    for (let attempt = 0; ; attempt++) {
      await line.turn();
      const answer = await ask<T>(path, key, params);
      if ("problem" in answer && answer.problem === "quota" && attempt < REFUSED_RETRIES) {
        // The per-second limit clears in a second (the member may have another screen calling with this key).
        line.refused(refusedWait(attempt));
        continue;
      }
      return answer;
    }
  };
}
type Get = ReturnType<typeof paced>;

class Refused extends Error {
  readonly problem: KeyProblem;
  constructor(problem: KeyProblem) {
    super(problem);
    this.problem = problem;
  }
}
const problemOf = (e: unknown): KeyProblem => (e instanceof Refused ? e.problem : "failed");

/** One of the member's connected accounts, its key opened (null = it does not open). */
type Opened = { id: number; name: string; stamp: string; get: Get | null };

/** Rows are read with the service role key (members cannot read the sealed key), so the query names the member. */
async function openAccounts(memberId: string): Promise<Opened[] | null> {
  const rows = await supabaseAdmin().from("nexon_accounts").select("id, label, key_cipher, updated_at").eq("user_id", memberId).order("created_at");
  if (rows.error) return null;
  return rows.data.map((row) => {
    let get: Get | null = null;
    try {
      get = paced(openKey(row.key_cipher, process.env.MAPLE_KEY_SECRET, memberId), lineFor(`${memberId}|${row.id}|${row.updated_at}`));
    } catch {
      // Sealed with another secret, or changed: shown as a problem of this account.
    }
    return { id: row.id as number, name: unpackLabel(row.label).name, stamp: String(row.updated_at), get };
  });
}

/**
 * What NEXON said, kept for `keepMs` under the member's tag (새로 고침 drops it all). The key is never part of
 * what is kept. A new window every `keepMs`: a stale answer is never served while a new one is fetched behind it.
 * A refusal is thrown, so it is not kept and the next visit asks again.
 */
function kept<T>(memberId: string, account: Opened, what: string, read: () => Promise<T>, keepMs = KEEP_MS): Promise<T> {
  const window = Math.floor(Date.now() / keepMs);
  const parts = ["homework", memberId, String(account.id), account.stamp, what, String(window)];
  return once(reading, parts.join("|"), () => unstable_cache(read, parts, { revalidate: keepMs / 1000, tags: [homeworkTag(memberId)] })());
}

/** Every character of the account, highest first (as of the last hour: a level on show comes from the scheduler's answer). */
function listOf(memberId: string, account: Opened, get: Get): Promise<Listed[]> {
  return kept(memberId, account, "list", readList, LIST_KEEP_MS);
  async function readList() {
    const list = await get<RawCharacterList>("character/list");
    if ("problem" in list) throw new Refused(list.problem);
    return (list.body.account_list ?? [])
      .flatMap((a) => a.character_list ?? [])
      .filter((c) => c.ocid && c.character_name)
      .map((c) => ({ ocid: c.ocid as string, name: c.character_name as string, world: c.world_name ?? "", job: c.character_class ?? "", level: c.character_level ?? 0 }))
      .sort((a, b) => b.level - a.level);
  }
}

type Answer = { at: number; /** As the scheduler says it now; 0 = it does not. */ level: number; hw: CharHomework; shared: AccountHomework; clears: number; limit: number };

/** One character's scheduler, already worked out (the raw answer is some 15 KB a character; this is what the page needs). */
function answerOf(memberId: string, account: Opened, get: Get, ocid: string): Promise<Answer> {
  return kept(memberId, account, ocid, async () => {
    const answer = await get<HomeworkState>("scheduler/character-state", { ocid });
    if ("problem" in answer) throw new Refused(answer.problem);
    const state = answer.body;
    return { at: Date.now(), level: state.character_level ?? 0, hw: charHomework(state), shared: accountHomework([state]), clears: state.weekly_boss_clear_count ?? 0, limit: state.weekly_boss_clear_limit_count ?? 0 };
  });
}

type Lists = { account: Opened; list: Listed[]; problem?: AccountProblem }[];

async function listsOf(memberId: string, accounts: Opened[]): Promise<Lists> {
  return Promise.all(
    accounts.map(async (account) => {
      if (!account.get) return { account, list: [], problem: "locked" as const };
      try {
        return { account, list: await listOf(memberId, account, account.get) };
      } catch (e) {
        return { account, list: [], problem: problemOf(e) };
      }
    })
  );
}

/** The pick as it applies to these accounts: the picked characters that are really theirs, or null when none is. */
function appliedPick(lists: Lists, picked: string[]): Set<string> | null {
  const owned = new Set(lists.flatMap((l) => l.list.map((c) => c.ocid)));
  const mine = picked.filter((o) => owned.has(o));
  return mine.length ? new Set(mine) : null;
}

/** The member's accounts with their characters, and the pick as it applies to them. null = the accounts could not be read. */
async function memberLists(memberId: string, picked: string[]): Promise<{ lists: Lists; pick: Set<string> | null } | null> {
  const opened = await openAccounts(memberId);
  if (!opened) return null;
  const lists = await listsOf(memberId, opened);
  return { lists, pick: appliedPick(lists, picked) };
}

/** The characters of an account that are on show: the picked ones, or its highest. */
const onShow = (list: Listed[], pick: Set<string> | null) => (pick ? list.filter((c) => pick.has(c.ocid)) : list.slice(0, PER_ACCOUNT));

/**
 * The homework of every NEXON account connected to the member. `picked` = the characters the member chose (the
 * cookie of lib/homework/pick.ts); without one, the highest of each account that have any homework.
 * `picking` tells whether the member's own pick is what is shown.
 */
export async function memberHomework(memberId: string, picked: string[]): Promise<{ accounts: AccountView[]; picking: boolean } | null> {
  const found = await memberLists(memberId, picked);
  if (!found) return null;
  const { lists, pick } = found;
  const accounts = await Promise.all(
    lists.map(async ({ account, list, problem }): Promise<AccountView> => {
      const base = { id: account.id, name: account.name };
      const get = account.get;
      if (problem || !get) return { ...base, problem: problem ?? "locked", chars: [], shared: mergeShared([]), failed: 0, at: 0 };
      const asked = onShow(list, pick);
      const answers = await Promise.all(asked.map((c) => answerOf(memberId, account, get, c.ocid).catch((e) => problemOf(e))));
      const good = answers.filter((a): a is Answer => typeof a !== "string");
      // Nobody answered: the reason is the account's (maintenance, the day's call limit), not a character's.
      if (asked.length > 0 && good.length === 0) return { ...base, problem: answers[0] as KeyProblem, chars: [], shared: mergeShared([]), failed: 0, at: 0 };
      const chars: CharView[] = [];
      asked.forEach((c, i) => {
        const a = answers[i];
        if (typeof a === "string") return;
        // The member's own pick is shown whatever it holds; the automatic one only where there is homework.
        if (!pick && a.hw.today.total + a.hw.week.total + a.hw.bosses.total + a.hw.monthly.total === 0) return;
        chars.push({ ...c, level: a.level || c.level, hw: a.hw, clears: a.clears, limit: a.limit });
      });
      return { ...base, chars, shared: mergeShared(good.map((a) => a.shared)), failed: answers.length - good.length, at: good.length ? Math.min(...good.map((a) => a.at)) : 0 };
    })
  );
  return { accounts, picking: !!pick };
}

export type PickData = {
  accounts: { id: number; name: string; chars: Listed[] }[];
  /** How many accounts did not give their characters. Saving a pick then would drop what was picked of them. */
  missing: number;
  /** The characters on show now: the member's pick, or the automatic one. */
  picked: string[];
  /** `picked` is the member's own pick (read now, not what the page showed). */
  picking: boolean;
  max: number;
};

/** Every character the member could pick, for the picker (the lists are the kept ones: no call when the page just showed). */
export async function memberCharacters(memberId: string, picked: string[]): Promise<PickData | null> {
  const found = await memberLists(memberId, picked);
  if (!found) return null;
  const { lists, pick } = found;
  return {
    accounts: lists.map(({ account, list }) => ({ id: account.id, name: account.name, chars: list })),
    missing: lists.filter((l) => l.problem).length,
    picking: !!pick,
    picked: lists.flatMap(({ list }) => onShow(list, pick).map((c) => c.ocid)),
    max: MAX_PICKED,
  };
}

export type Card = CharView & { accountId: number; chips: string[] };
/** The four numbers at the top of the page, or of one account's tab. */
export type Sum = ReturnType<typeof summarize>;
/** An account as the screen draws it: its characters are in `cards`, its own four numbers in `sum`. */
export type AccountBoard = Omit<AccountView, "chars" | "at"> & { sum: Sum; /** Homework left: the account's own and its characters'. */ left: number };
/** Everything the screen draws, worked out here so the browser gets values, not the rules (nor the price tables they import). */
export type BoardData = {
  accounts: AccountBoard[];
  /** Characters of every account: account by account, most left first within each. */
  cards: Card[];
  /** The member's own pick is on show (otherwise the automatic one). */
  picking: boolean;
  sum: Sum;
  daily: { hours: number; minutes: number };
  weekly: { days: number; hours: number };
  /** "15:34" (KST): when the oldest answer on the screen was asked for; "" when there is none. */
  time: string;
};

export function boardData(accounts: AccountView[], picking: boolean, now: number): BoardData {
  // Account by account (the page shows a tab per account), most left first within each.
  const cards: Card[] = accounts.flatMap((a) => a.chars.map((c) => ({ ...c, accountId: a.id, chips: leftChips(c.hw) })).sort((x, y) => y.hw.left - x.hw.left || y.level - x.level));
  const asked = accounts.filter((a) => a.at > 0).map((a) => a.at);
  // kstStamp = "11/24 15:34": the clock part.
  const oldest = asked.length ? kstStamp(Math.min(...asked)).slice(-5) : "";
  return {
    // The characters go once, as cards; each account carries the numbers of its own tab instead.
    accounts: accounts.map((a) => {
      const sum = summarize(a.chars.map((c) => c.hw), [a.shared]);
      return { id: a.id, name: a.name, problem: a.problem, shared: a.shared, failed: a.failed, sum, left: sum.today.left + sum.week.left + sum.bosses.left + sum.monthly.left };
    }),
    cards,
    picking,
    sum: summarize(cards.map((c) => c.hw), accounts.map((a) => a.shared)),
    daily: untilDailyReset(now),
    weekly: untilReset(now),
    time: oldest,
  };
}

/** `memberHomework` as the screen draws it, at this moment. null = the member's accounts could not be read. */
export async function memberBoard(memberId: string, picked: string[]): Promise<BoardData | null> {
  const found = await memberHomework(memberId, picked);
  return found && boardData(found.accounts, found.picking, Date.now());
}
