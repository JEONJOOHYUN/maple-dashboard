"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openRevenue, readFaces, readSchedulers, refreshRevenue } from "@/app/revenue/actions";
import { ApiError, characterList, createApi, type Api, type ApiErrorKind, type RawCharacterList } from "@/lib/enhance/client";
import type { SavedKey } from "@/lib/enhance/keys";
import { kstDate } from "@/lib/enhance/kst";
import { fillThin, isThin, latestFull, schedulerAsk, type Registrations } from "@/lib/homework/thin";
import type { HomeworkState } from "@/lib/homework/model";
import { NOT_READY } from "@/lib/nexon/open-api";
import { lastWeekOr, type SchedulerState } from "@/lib/revenue/calc";
import { MAX_ASKED } from "@/lib/revenue/data";
import type { MemberRevenue } from "@/lib/revenue/server";
import { useStored } from "@/lib/use-stored";

export type Char = { ocid: string; name: string; world: string; job: string; level: number; account: string };
/** locked = a key kept with the member's account that does not open any more. */
export type Problem = ApiErrorKind | "locked";
export type AccountState = { status: "ok" | "error"; error?: Problem; chars: Char[] };

function charsOf(body: RawCharacterList, account: string): Char[] {
  const out: Char[] = [];
  for (const a of body.account_list ?? [])
    for (const c of a.character_list ?? [])
      if (c.ocid && c.character_name)
        out.push({ ocid: c.ocid, name: c.character_name, world: c.world_name ?? "", job: c.character_class ?? "", level: c.character_level ?? 0, account });
  return out.sort((x, y) => y.level - x.level);
}

type States = Record<string, SchedulerState | null>;
/**
 * Where an account's data comes from. Each answer comes back through `on`: every character asked is answered once
 * (null = that call failed), one by one or together.
 */
type Source = {
  /** The account's characters, highest first, or why they did not come. */
  list(account: string): Promise<Char[] | Problem>;
  /** `at` = when NEXON was asked (0 = nothing answered). `again` = not from what the page already holds. */
  states(chars: Char[], date: string | undefined, again: boolean, on: (answers: States, at: number) => void): void;
  /** `asked` = the ids this answer closes, with or without a picture. */
  faces(chars: Char[], on: (found: Record<string, string>, asked: string[]) => void): void;
  /** Before asking again: drops what is kept in between. false = asked too often (the kept answers come back). */
  renew?(): Promise<boolean>;
};

/** Latest full answers found this visit, by character and day (lib/homework/thin.ts): past days do not change. A search that failed is dropped, so the next asks again. */
const fulls = new Map<string, Promise<Registrations | null>>();

/** A thin answer (not logged in since the reset) with the registrations of the character's latest full day. */
function filled(api: Api, ocid: string, today: HomeworkState): Promise<HomeworkState> {
  if (!isThin(today)) return Promise.resolve(today);
  const now = Date.now();
  const key = `${kstDate(now)}|${ocid}`;
  let full = fulls.get(key);
  if (!full) {
    const search = latestFull(now, (date) =>
      api.get<HomeworkState>(...schedulerAsk(ocid, date)).then(
        (body) => ({ body }),
        (err) => ({ kind: err instanceof ApiError ? err.kind : "failed" })
      )
    );
    search.catch(() => fulls.delete(key));
    fulls.set(key, (full = search));
  }
  // A failed search shows today's answer as it came.
  return full.then((found) => fillThin(today, found), () => today);
}

/** A key kept in this browser: NEXON is asked straight from here, and the key never reaches our server. */
function keySource(api: Api): Source {
  return {
    list: (account) => characterList(api).then(
      (body) => charsOf(body, account),
      (err) => (err instanceof ApiError ? err.kind : "failed")
    ),
    states(chars, date, _again, on) {
      for (const c of chars)
        // A past day as it came (last week's last day); today's filled when it is thin.
        (date
          ? lastWeekOr(date, (day) => api.get<SchedulerState>(...schedulerAsk(c.ocid, day)), (e) => e instanceof ApiError && e.code === NOT_READY)
          : api.get<HomeworkState>(...schedulerAsk(c.ocid)).then((s) => filled(api, c.ocid, s))
        ).then(
          (s) => on({ [c.ocid]: s }, Date.now()),
          () => on({ [c.ocid]: null }, 0)
        );
    },
    faces(chars, on) {
      for (const c of chars)
        api.get<{ character_image?: string }>("character/basic", { ocid: c.ocid }).then(
          (b) => on(b.character_image ? { [c.ocid]: b.character_image } : {}, [c.ocid]),
          () => on({}, [c.ocid])
        );
    },
  };
}

/**
 * The characters to ask about (`take` says which, and marks them as asked), by where their account's data comes
 * from: those of one source go together, so a member's are one call to our server.
 */
function bySource(chars: Char[], sources: Record<string, Source>, take: (c: Char) => boolean): Map<Source, Char[]> {
  const groups = new Map<Source, Char[]>();
  for (const c of chars) {
    const source = sources[c.account];
    if (!source || !take(c)) continue;
    const group = groups.get(source);
    if (group) group.push(c);
    else groups.set(source, [c]);
  }
  return groups;
}

/** `ids` in parts the server answers whole (it takes MAX_ASKED a call and drops the rest). */
function batches(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += MAX_ASKED) out.push(ids.slice(i, i + MAX_ASKED));
  return out;
}

/**
 * The NEXON accounts connected to the signed-in member: our server asks with the keys it keeps (they never come
 * here). The browser sends one server call at a time, so every batch of characters is one call. `first` = what the
 * page opened with: the accounts, and the schedulers of the characters followed.
 */
function memberSource(first: MemberRevenue): Source {
  let accounts = new Map(first.accounts.map((a) => [a.id, a]));
  const served = new Set<string>();
  let reopening: Promise<void> | null = null;
  const seed = new Map(Object.entries(first.states));
  const reopen = () =>
    (reopening ??= openRevenue()
      .then((again) => {
        if (typeof again === "object") accounts = new Map(again.accounts.map((a) => [a.id, a]));
      })
      .catch(() => {})
      .finally(() => {
        reopening = null;
      }));
  return {
    async list(account) {
      // The first time from what the page opened with; asked again (a retry), from the server.
      if (served.has(account)) await reopen();
      served.add(account);
      const found = accounts.get(account);
      if (!found) return "failed";
      return found.problem ?? found.chars.map((c) => ({ ...c, account }));
    },
    states(chars, date, again, on) {
      const ask: string[] = [];
      const here: States = {};
      for (const c of chars) {
        // What came with the page is handed out once (this week's only); one that failed then is asked again.
        const kept = date ? undefined : seed.get(c.ocid);
        if (!date) seed.delete(c.ocid);
        if (kept == null || again) ask.push(c.ocid);
        else here[c.ocid] = kept;
      }
      if (Object.keys(here).length) queueMicrotask(() => on(here, first.at));
      for (const part of batches(ask)) {
        const none = () => on(Object.fromEntries(part.map((o) => [o, null])), 0);
        readSchedulers(part, date).then((found) => {
          if (typeof found !== "object") return none();
          on(Object.fromEntries(part.map((o) => [o, found.states[o] ?? null])), found.at);
        }, none);
      }
    },
    faces(chars, on) {
      for (const part of batches(chars.map((c) => c.ocid)))
        readFaces(part).then(
          (found) => on(found, part),
          () => on({}, part)
        );
    },
    renew: () => {
      seed.clear();
      return refreshRevenue().then(
        (r) => r !== "limited",
        () => true
      );
    },
  };
}

/**
 * NEXON data for the accounts in use: each account's character list once (no entry yet = still coming), and a
 * character's scheduler when it is asked for. The accounts are either keys kept in this browser (asked straight from
 * here) or, with `registered`, the accounts connected to the signed-in member (asked by our server). Schedulers are
 * kept per boss week (`week`): when the week turns, the page asks again instead of showing last week's clears.
 * `states[ocid]` = null when that call failed. `prev[ocid]` = the scheduler on the last day of last week (monthly
 * bosses). Nothing is cancelled when the page closes: a late answer is simply dropped (cancelling broke the doubled
 * first run of effects in development, which left calls marked as failed).
 */
export function useRevenueData(keys: SavedKey[], registered: MemberRevenue | null, week: string, lastWeek: string) {
  const signature = registered ? "" : keys.map((k) => `${k.account}:${k.key}`).join(",");
  const sources = useMemo(() => {
    const out: Record<string, Source> = {};
    if (registered) {
      const source = memberSource(registered);
      for (const a of registered.accounts) out[a.id] = source;
      return out;
    }
    for (const part of signature ? signature.split(",") : []) {
      const at = part.indexOf(":");
      out[part.slice(0, at)] = keySource(createApi(part.slice(at + 1), part.slice(0, at)));
    }
    return out;
  }, [signature, registered]);

  const [accounts, setAccounts] = useState<Record<string, AccountState>>({});
  const [tick, setTick] = useState(0);
  const asked = useRef(new Set<string>());
  useEffect(() => {
    for (const [account, source] of Object.entries(sources)) {
      if (asked.current.has(account)) continue;
      asked.current.add(account);
      source.list(account).then((found) => {
        if (typeof found !== "string") return setAccounts((prev) => ({ ...prev, [account]: { status: "ok", chars: found } }));
        // Asked again on the next retry (or when the key is added again).
        asked.current.delete(account);
        setAccounts((prev) => ({ ...prev, [account]: { status: "error", error: found, chars: [] } }));
      });
    }
  }, [sources, tick]);
  /** The character lists that failed, once more. */
  const retryAccounts = useCallback(() => {
    setAccounts((prev) => Object.fromEntries(Object.entries(prev).filter(([, a]) => a.status !== "error")));
    setTick((n) => n + 1);
  }, []);

  // Keyed "week|ocid" (this week's) and "date|ocid" (last week's last day).
  const [cache, setCache] = useState<Record<string, SchedulerState | null>>({});
  const inflight = useRef(new Set<string>());
  const [loadedAt, setLoadedAt] = useState(0);
  const ask = useCallback(
    (chars: Char[], slot: string, date: string | undefined, again: boolean) => {
      const groups = bySource(chars, sources, (c) => {
        const key = `${slot}|${c.ocid}`;
        if (inflight.current.has(key) || (!again && key in cache)) return false;
        inflight.current.add(key);
        return true;
      });
      for (const [source, group] of groups)
        source.states(group, date, again, (answers, at) => {
          setCache((prev) => {
            const next = { ...prev };
            for (const [ocid, s] of Object.entries(answers)) next[`${slot}|${ocid}`] = s;
            return next;
          });
          if (at) setLoadedAt(at);
          for (const ocid of Object.keys(answers)) inflight.current.delete(`${slot}|${ocid}`);
        });
    },
    [sources, cache]
  );
  /** This week's scheduler of these characters (each once; `again` asks even the ones already here). */
  const load = useCallback((chars: Char[], again = false) => ask(chars, week, undefined, again), [ask, week]);
  /** The scheduler of these characters on the last day of last week. */
  const loadPrev = useCallback((chars: Char[]) => ask(chars, lastWeek, lastWeek, false), [ask, lastWeek]);

  const pick = useCallback(
    (slot: string) => {
      const out: Record<string, SchedulerState | null> = {};
      const head = `${slot}|`;
      for (const [k, v] of Object.entries(cache)) if (k.startsWith(head)) out[k.slice(head.length)] = v;
      return out;
    },
    [cache]
  );
  const states = useMemo(() => pick(week), [pick, week]);
  const prev = useMemo(() => pick(lastWeek), [pick, lastWeek]);

  // Each character's look picture (NEXON's address), asked once and kept: it only changes when the look does, and a
  // refresh asks again.
  const [faces, setFaces] = useStored<Record<string, string>>("revenue:faces", {});
  const askedFace = useRef(new Set<string>());
  const facePending = useRef(new Set<string>());
  const loadFaces = useCallback(
    (chars: Char[], again = false) => {
      const groups = bySource(chars, sources, (c) => {
        if (facePending.current.has(c.ocid) || (!again && (faces[c.ocid] || askedFace.current.has(c.ocid)))) return false;
        askedFace.current.add(c.ocid);
        facePending.current.add(c.ocid);
        return true;
      });
      for (const [source, group] of groups)
        source.faces(group, (found, closed) => {
          if (Object.keys(found).length) setFaces((prev) => ({ ...prev, ...found }));
          for (const ocid of closed) facePending.current.delete(ocid);
        });
    },
    [sources, faces, setFaces]
  );

  /** A member's refresh came too soon after the last ones: what is shown is what was kept. */
  const [limited, setLimited] = useState(false);
  /** These characters' schedulers again, last week's ones that failed or were read from the day before, and any character list that failed. */
  const refresh = useCallback(
    (chars: Char[]) => {
      const again = () => {
        retryAccounts();
        load(chars, true);
        loadFaces(chars, true);
        ask(chars.filter((c) => { const p = cache[`${lastWeek}|${c.ocid}`]; return p === null || !!p?.asOf; }), lastWeek, lastWeek, true);
      };
      const renewals = [...new Set(Object.values(sources))].flatMap((s) => (s.renew ? [s.renew()] : []));
      if (!renewals.length) return again();
      void Promise.all(renewals).then((fresh) => {
        setLimited(fresh.includes(false));
        again();
      });
    },
    [load, retryAccounts, cache, lastWeek, ask, loadFaces, sources]
  );

  return { accounts, states, prev, faces, load, loadPrev, loadFaces, refresh, retryAccounts, loadedAt, limited };
}
