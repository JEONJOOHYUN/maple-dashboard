// Boss revenue for a signed-in member, on the server. Two things a member has that a visitor's browser does not:
// the NEXON keys kept with the account (so the page opens on any device without pasting a key; the keys are
// opened here and never leave), and the settings kept with the account (lib/revenue/settings.ts).
// NEXON is asked through the same lines and the same kept answers as the homework page (lib/homework/server.ts):
// one scheduler answer per character serves both pages.
import "server-only";
import { createHash } from "node:crypto";
import { answerOf, kept, listsOf, openAccounts, Refused, type AccountProblem, type Answer, type Get, type Listed, type Opened } from "@/lib/homework/server";
import { schedulerAsk } from "@/lib/homework/thin";
import { NOT_READY } from "@/lib/nexon/open-api";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { bossLines, lastWeekDate, lastWeekOr, type SchedulerState } from "./calc";
import { MAX_PICKED } from "./data";
import { applyPatch, noSettings, rowOf, settingsOf, tooBig, type Patch, type Settings, type SettingsRow } from "./settings";

/** Last week's scheduler does not change any more, but the day it is first asked NEXON may still be filling it. */
const PREV_KEEP_MS = 30 * 60_000;
/** A look picture's address changes only with the look (새로 고침 asks again). */
const FACE_KEEP_MS = 60 * 60_000;
const DAY = 86_400_000;

/** A connected NEXON account as the page names it: never the same as the id of a key kept in a browser (hex). */
const accountId = (id: number) => `m${id}`;

export type MemberAccount = { id: string; name: string; chars: Listed[]; problem?: AccountProblem };
/** Schedulers by character id (null = that one did not answer) and when the oldest of them was asked for (0 = none). */
export type States = { states: Record<string, SchedulerState | null>; at: number };
export type MemberRevenue = States & {
  /** Tells this member's unsent changes from another member's in a shared browser; says nothing else about the member. */
  who: string;
  accounts: MemberAccount[];
  /** null = the member has not saved any yet. */
  settings: Settings | null;
};

type Owned = Map<string, { account: Opened; get: Get; level: number }>;

/** The member's accounts with their characters, and whose key answers for each character. null = they could not be read. */
async function accountsOf(memberId: string): Promise<{ accounts: MemberAccount[]; owned: Owned } | null> {
  const opened = await openAccounts(memberId);
  if (!opened) return null;
  const lists = await listsOf(memberId, opened);
  const owned: Owned = new Map();
  for (const { account, list } of lists) {
    const get = account.get;
    if (get) for (const c of list) if (!owned.has(c.ocid)) owned.set(c.ocid, { account, get, level: c.level });
  }
  return { accounts: lists.map(({ account, list, problem }) => ({ id: accountId(account.id), name: account.name, chars: list, problem })), owned };
}

const stateOf = (a: Answer): SchedulerState => ({ boss_contents: a.boss, weekly_boss_clear_count: a.clears, weekly_boss_clear_limit_count: a.limit });

/**
 * The scheduler of one character on a past day: only its boss lines are kept. Not ready yet: the day before (a
 * refusal is not kept, so the asked day is tried again next time).
 */
function pastOf(memberId: string, account: Opened, get: Get, ocid: string, date: string): Promise<SchedulerState> {
  const read = (day: string) =>
    kept(
      memberId,
      account,
      `past|${day}|${ocid}`,
      async (): Promise<SchedulerState> => {
        const answer = await get<SchedulerState>(...schedulerAsk(ocid, day));
        if ("problem" in answer) throw new Refused(answer.problem, answer.code);
        return { boss_contents: bossLines(answer.body) };
      },
      PREV_KEEP_MS
    );
  return lastWeekOr(date, read, (e) => e instanceof Refused && e.code === NOT_READY);
}

/** The past days the page asks for: the last day of last week, as this server or a browser a day off counts it. */
const pastDays = (now: number) => new Set([lastWeekDate(now - DAY), lastWeekDate(now), lastWeekDate(now + DAY)]);

/** Schedulers of the member's own characters among `ocids` (another's id is simply not answered). */
async function statesOf(memberId: string, owned: Owned, ocids: string[], date?: string): Promise<States> {
  const states: Record<string, SchedulerState | null> = {};
  let at = 0;
  await Promise.all(
    ocids.map(async (ocid) => {
      const mine = owned.get(ocid);
      if (!mine) return;
      try {
        if (date) states[ocid] = await pastOf(memberId, mine.account, mine.get, ocid, date);
        else {
          const answer = await answerOf(memberId, mine.account, mine.get, ocid);
          states[ocid] = stateOf(answer);
          at = at ? Math.min(at, answer.at) : answer.at;
        }
      } catch {
        states[ocid] = null;
      }
    })
  );
  return { states, at };
}

/**
 * What the page opens with: the member's accounts and characters, the settings, and (one round trip instead of
 * two) this week's schedulers of the characters the member follows. null = the accounts or settings could not be read.
 */
export async function memberRevenue(memberId: string): Promise<MemberRevenue | null> {
  const [found, settings] = await Promise.all([accountsOf(memberId), readSettings(memberId)]);
  if (!found || settings === undefined) return null;
  // As the page orders them: the picked ones that are the member's, highest first, as many as it shows.
  const followed = (settings?.picked ?? [])
    .filter((o) => found.owned.has(o))
    .sort((a, b) => (found.owned.get(b)?.level ?? 0) - (found.owned.get(a)?.level ?? 0))
    .slice(0, MAX_PICKED);
  const who = createHash("sha256").update(`revenue:${memberId}`).digest("hex").slice(0, 16);
  return { who, accounts: found.accounts, settings, ...(await statesOf(memberId, found.owned, followed)) };
}

/** Schedulers of these characters: this week's, or (with `date`) the last day of last week's. null = not readable. */
export async function memberSchedulers(memberId: string, ocids: string[], date?: string): Promise<States | null> {
  if (date !== undefined && !pastDays(Date.now()).has(date)) return { states: {}, at: 0 };
  const found = await accountsOf(memberId);
  return found && statesOf(memberId, found.owned, ocids, date);
}

/** Look pictures of these characters by id (NEXON's own address; left out when there is none). */
export async function memberFaces(memberId: string, ocids: string[]): Promise<Record<string, string> | null> {
  const found = await accountsOf(memberId);
  if (!found) return null;
  const faces: Record<string, string> = {};
  await Promise.all(
    ocids.map(async (ocid) => {
      const mine = found.owned.get(ocid);
      if (!mine) return;
      const url = await kept(
        memberId,
        mine.account,
        `face|${ocid}`,
        async () => {
          const answer = await mine.get<{ character_image?: string }>("character/basic", { ocid });
          if ("problem" in answer) throw new Refused(answer.problem);
          const image = answer.body.character_image;
          return typeof image === "string" && image.startsWith("https://open.api.nexon.com/") ? image : "";
        },
        FACE_KEEP_MS
      ).catch(() => "");
      if (url) faces[ocid] = url;
    })
  );
  return faces;
}

const COLUMNS = "party, prices, got_week, got, fee, material, picked, auto_picked, rev";

/**
 * The settings kept for the member: null = none yet, undefined = they could not be read. The table has no policy
 * (migration 013), so it is read with the service role key and the query names the member.
 */
export async function readSettings(memberId: string): Promise<Settings | null | undefined> {
  const found = await supabaseAdmin().from("revenue_settings").select(COLUMNS).eq("user_id", memberId).maybeSingle();
  if (found.error) return undefined;
  return found.data ? settingsOf(found.data as SettingsRow) : null;
}

/**
 * Merges a (cleaned) patch into the member's settings. The row is only written while it is still the one that was
 * read (`rev`): two devices saving at the same moment both land, the second on top of the first.
 */
export async function saveSettings(memberId: string, patch: Patch): Promise<boolean> {
  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 3; attempt++) {
    const found = await db.from("revenue_settings").select(COLUMNS).eq("user_id", memberId).maybeSingle();
    if (found.error) return false;
    const next = applyPatch(found.data ? settingsOf(found.data as SettingsRow) : noSettings(), patch);
    if (tooBig(next)) return false;
    if (!found.data) {
      const made = await db.from("revenue_settings").insert({ user_id: memberId, ...rowOf(next) });
      if (!made.error) return true;
      // 23505: another device made the row in between; anything else (the member is gone) is a failure.
      if (made.error.code !== "23505") return false;
      continue;
    }
    const rev = Number(found.data.rev);
    const written = await db
      .from("revenue_settings")
      .update({ ...rowOf(next), rev: rev + 1, updated_at: new Date().toISOString() })
      .eq("user_id", memberId)
      .eq("rev", rev)
      .select("rev");
    if (written.error) return false;
    if (written.data.length > 0) return true;
  }
  return false;
}
