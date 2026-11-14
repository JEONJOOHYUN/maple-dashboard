"use client";

// Which world a character was in at a given time, for the potential board: its rolls carry no world.
// Read from what this browser already has for the key (its saved star force tries) plus one call for where the
// account's characters are now (kept for a day). See lib/enhance/worlds.ts for how the two are put together.
import { useCallback, useEffect, useMemo, useState } from "react";
import { characterClasses, characterInsights, characterWorlds, savedTries } from "@/lib/enhance/sync";
import { worldAt, worldRuns } from "@/lib/enhance/worlds";

type Try = { t: number; who: string; world: string };
const NO_TRIES: Try[] = [];
const NO_WORLDS: Record<string, string> = {};

/**
 * Loaded as soon as the board opens, whatever becomes of the history fetch: when that fails halfway (network, call
 * limit) the saved rolls are still on screen, and a group that is switched off must stay out of them.
 * `tries` = star force tries of the period on screen, as they arrive (the board fetches them quietly): with them a
 * browser that never opened the star force tab still knows where a character was.
 * `fetchedAt` = when that fetch last completed. What is saved is read again then, so the tries of a period that
 * was on screen before keep counting after the period is made shorter: a character's world must not change with
 * the period that happens to be shown.
 * Until the worlds are known every roll counts as a regular-world one.
 */
export function useWorldOf(apiKey: string, account: string, tries: Try[], fetchedAt: number): (who: string, t: number) => string {
  const [saved, setSaved] = useState(NO_TRIES);
  const [now, setNow] = useState(NO_WORLDS);
  // What is saved, on its own: it needs no network.
  useEffect(() => {
    let alive = true;
    savedTries(account)
      .then((rows) => {
        if (alive) setSaved(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [account, fetchedAt]);
  // Where the characters are now is added when it arrives.
  useEffect(() => {
    let alive = true;
    characterWorlds(apiKey, account)
      .then((worlds) => {
        if (alive) setNow(worlds);
      })
      .catch(() => {
        // Worlds are a way to filter: without them the board shows everything, as before.
      });
    return () => {
      alive = false;
    };
  }, [apiKey, account]);
  const runs = useMemo(() => worldRuns([...saved, ...tries]), [saved, tries]);
  return useCallback((who: string, t: number) => worldAt(runs, now, who, t), [runs, now]);
}

const NO_NAMES: ReadonlySet<string> = new Set();
type Jobs = { xenons: ReadonlySet<string>; avengers: ReadonlySet<string> };
const NO_JOBS: Jobs = { xenons: NO_NAMES, avengers: NO_NAMES };

/**
 * The account's Xenon and demon avenger characters. For a Xenon an all stat % line is a goal of its own (for every
 * other job it counts as main stat); a demon avenger's weapon and emblem count max HP % instead of main stat and all stat.
 * Asked with the same one call as the worlds; until it is known (or when it fails) nobody is either.
 */
export function useJobs(apiKey: string, account: string): Jobs {
  const [jobs, setJobs] = useState(NO_JOBS);
  useEffect(() => {
    let alive = true;
    characterClasses(apiKey, account)
      .then((classes) => {
        const of = (job: string) => new Set(Object.keys(classes).filter((who) => classes[who] === job));
        if (alive) setJobs({ xenons: of("제논"), avengers: of("데몬어벤져") });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [apiKey, account]);
  return jobs;
}

const NO_INSIGHTS: Record<string, number> = {};

/**
 * 통찰력 level of the characters whose cube fee depends on it (`names`, a list that keeps its identity while its
 * content is the same). Asked once the records have stopped arriving (`ready`), so a growing list is not asked
 * about again and again. Until it is known, and for a character that cannot be asked about, the fee counts as waived.
 */
export function useInsights(apiKey: string, account: string, names: string[], ready: boolean): Record<string, number> {
  const [levels, setLevels] = useState(NO_INSIGHTS);
  useEffect(() => {
    if (!ready || names.length === 0) return;
    const stop = new AbortController();
    characterInsights(apiKey, account, names, stop.signal)
      .then((next) => {
        if (!stop.signal.aborted) setLevels(next);
      })
      .catch(() => {
        // The fee of a few cubes on low items: not worth failing anything for.
      });
    return () => stop.abort();
  }, [apiKey, account, names, ready]);
  return levels;
}
