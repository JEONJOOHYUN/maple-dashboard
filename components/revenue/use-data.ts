"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, createApi, type Api, type ApiErrorKind, type RawCharacterList } from "@/lib/enhance/client";
import type { SavedKey } from "@/lib/enhance/keys";
import type { SchedulerState } from "@/lib/revenue/calc";
import { useStored } from "@/lib/use-stored";

export type Char = { ocid: string; name: string; world: string; job: string; level: number; account: string };
export type AccountState = { status: "ok" | "error"; error?: ApiErrorKind; chars: Char[] };

function charsOf(body: RawCharacterList, account: string): Char[] {
  const out: Char[] = [];
  for (const a of body.account_list ?? [])
    for (const c of a.character_list ?? [])
      if (c.ocid && c.character_name)
        out.push({ ocid: c.ocid, name: c.character_name, world: c.world_name ?? "", job: c.character_class ?? "", level: c.character_level ?? 0, account });
  return out.sort((x, y) => y.level - x.level);
}

/**
 * NEXON data for the keys in use, all straight from this browser (the key never reaches our server): each key's
 * character list once (no entry yet = still coming), and a character's scheduler when it is asked for. Schedulers
 * are kept per boss week (`week`): when the week turns, the page asks again instead of showing last week's clears.
 * `states[ocid]` = null when that call failed. `prev[ocid]` = the scheduler on the last day of last week (monthly
 * bosses). Nothing is cancelled when the page closes: a late answer is simply dropped (cancelling broke the doubled
 * first run of effects in development, which left calls marked as failed).
 */
export function useRevenueData(keys: SavedKey[], week: string, lastWeek: string) {
  const signature = keys.map((k) => `${k.account}:${k.key}`).join(",");
  const apis = useMemo(() => {
    const out: Record<string, Api> = {};
    for (const part of signature ? signature.split(",") : []) {
      const at = part.indexOf(":");
      out[part.slice(0, at)] = createApi(part.slice(at + 1), part.slice(0, at));
    }
    return out;
  }, [signature]);

  const [accounts, setAccounts] = useState<Record<string, AccountState>>({});
  const [tick, setTick] = useState(0);
  const asked = useRef(new Set<string>());
  useEffect(() => {
    for (const [account, api] of Object.entries(apis)) {
      if (asked.current.has(account)) continue;
      asked.current.add(account);
      api
        .get<RawCharacterList>("character/list", {})
        .then((body) => setAccounts((prev) => ({ ...prev, [account]: { status: "ok", chars: charsOf(body, account) } })))
        .catch((err) => {
          // Asked again on the next retry (or when the key is added again).
          asked.current.delete(account);
          setAccounts((prev) => ({ ...prev, [account]: { status: "error", error: err instanceof ApiError ? err.kind : "failed", chars: [] } }));
        });
    }
  }, [apis, tick]);
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
    (c: Char, slot: string, params: Record<string, string>, again: boolean) => {
      const api = apis[c.account];
      const key = `${slot}|${c.ocid}`;
      if (!api || inflight.current.has(key) || (!again && key in cache)) return;
      inflight.current.add(key);
      api
        .get<SchedulerState>("scheduler/character-state", { ocid: c.ocid, ...params })
        .then((s) => {
          setCache((prev) => ({ ...prev, [key]: s }));
          setLoadedAt(Date.now());
        })
        .catch(() => setCache((prev) => ({ ...prev, [key]: null })))
        .finally(() => inflight.current.delete(key));
    },
    [apis, cache]
  );
  /** This week's scheduler of these characters (each once; `again` asks even the ones already here). */
  const load = useCallback((chars: Char[], again = false) => chars.forEach((c) => ask(c, week, {}, again)), [ask, week]);
  /** The scheduler of these characters on the last day of last week. */
  const loadPrev = useCallback((chars: Char[]) => chars.forEach((c) => ask(c, lastWeek, { date: lastWeek }, false)), [ask, lastWeek]);

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
      for (const c of chars) {
        const api = apis[c.account];
        if (!api || facePending.current.has(c.ocid) || (!again && (faces[c.ocid] || askedFace.current.has(c.ocid)))) continue;
        askedFace.current.add(c.ocid);
        facePending.current.add(c.ocid);
        api
          .get<{ character_image?: string }>("character/basic", { ocid: c.ocid })
          .then((b) => {
            if (b.character_image) setFaces((prev) => ({ ...prev, [c.ocid]: b.character_image as string }));
          })
          .catch(() => {})
          .finally(() => facePending.current.delete(c.ocid));
      }
    },
    [apis, faces, setFaces]
  );

  /** These characters' schedulers again, last week's ones that failed, and any character list that failed. */
  const refresh = useCallback(
    (chars: Char[]) => {
      retryAccounts();
      load(chars, true);
      loadFaces(chars, true);
      for (const c of chars) if (cache[`${lastWeek}|${c.ocid}`] === null) ask(c, lastWeek, { date: lastWeek }, true);
    },
    [load, retryAccounts, cache, lastWeek, ask, loadFaces]
  );

  return { accounts, states, prev, faces, load, loadPrev, loadFaces, refresh, retryAccounts, loadedAt };
}
