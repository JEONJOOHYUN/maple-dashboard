"use client";

// The shared item dictionary as a board sees it: what it knows about this account's items, kept in the browser so
// pictures are there at once on the next visit. In return the browser tells the dictionary the item facts it found
// and the dictionary lacks. Item names, levels, icon codes and parts only — never the key, a character or the history.
import { useEffect } from "react";
import { lookupItems, reportItems } from "@/app/enhance/actions";
import { MAX_NAMES, MAX_REPORT, cleanName, fillOf, reportOf, type Dict } from "@/lib/enhance/dict";
import type { FoundItem } from "@/lib/enhance/items";
import { useStored } from "@/lib/use-stored";

/** `asked` = when the dictionary was last asked about a name (ms). */
type Saved = { items: Dict; asked: Record<string, number> };
const NOTHING: Saved = { items: {}, asked: {} };
/** What is in storage may be anything (an older shape, a hand-edited value): only the expected shape is used. */
const sane = (v: Saved | null | undefined): Saved => (v && typeof v.items === "object" && v.items !== null && typeof v.asked === "object" && v.asked !== null ? v : NOTHING);
/** A name the dictionary has no picture for is asked again after this long: someone else may have added it. */
const ASK_AGAIN = 24 * 3600_000;
/** Reports sent for one load of the records (the server takes 30 an hour from one address). */
const MAX_CHUNKS = 4;
/** Names already sent since the page was opened: a report that was refused is not sent over and over. */
const sent = new Set<string>();
/** One exchange at a time, in the order they were asked for: each starts from what the one before it saved. */
let line: Promise<void> = Promise.resolve();

export type Rolled = { item: string; level: number; part: string };
type Update = (next: (prev: Saved) => Saved) => void;

/**
 * Ask the dictionary about the names it has not been asked about, then tell it what it lacks. Everything is read
 * from and written to the saved copy itself, not a render's view of it, and a finished step is saved whether or
 * not the board that started it is still on screen: nothing here depends on a component being alive.
 */
async function exchange(names: string[], found: Record<string, FoundItem>, rolled: Rolled[], update: Update) {
  // The saved copy as it is now (the setter hands it over; it is put back unchanged).
  let now: Saved = NOTHING;
  update((prev) => (now = sane(prev)));
  const items = { ...now.items };
  const asked = { ...now.asked };

  const at = Date.now();
  // Every name this browser can say something about, or wants something for.
  const all = [...new Set([...names, ...Object.keys(found)])].filter((n) => cleanName(n) === n);
  const ask = all.filter((n) => !items[n]?.icon && !(asked[n] > at - ASK_AGAIN)).slice(0, MAX_NAMES);
  if (ask.length > 0) {
    const got = await lookupItems(ask);
    Object.assign(items, got);
    for (const n of ask) asked[n] = at;
    update((before) => {
      const prev = sane(before);
      return { items: { ...prev.items, ...got }, asked: { ...prev.asked, ...Object.fromEntries(ask.map((n) => [n, at])) } };
    });
  }

  // Only names the dictionary was asked about: without its answer there is no telling what it lacks.
  const report = reportOf(found, rolled, items).filter((it) => (asked[it.name] !== undefined || items[it.name] !== undefined) && !sent.has(it.name));
  for (let i = 0; i < report.length && i < MAX_CHUNKS * MAX_REPORT; i += MAX_REPORT) {
    const chunk = report.slice(i, i + MAX_REPORT);
    for (const it of chunk) sent.add(it.name);
    if (!(await reportItems(chunk))) return;
    // What the dictionary now has, the way the server merges it: a saved level stays, empty fields are filled.
    update((before) => {
      const prev = sane(before);
      const merged = { ...prev.items };
      for (const { name, ...fact } of chunk) {
        const old = merged[name];
        merged[name] = old ? { ...old, ...fillOf(old, fact) } : fact;
      }
      return { ...prev, items: merged };
    });
  }
}

/**
 * `ready` = the records are loaded. `names` = the items in them, `found` = the account's equipment,
 * `rolled` = level · part read from the potential history (empty for star force). All three must keep their
 * identity between renders (useMemo), or the exchange runs every time.
 */
export function useItemDict(ready: boolean, names: string[], found: Record<string, FoundItem>, rolled: Rolled[]): Dict {
  const [stored, setSaved] = useStored<Saved>("enhance:dict", NOTHING);

  useEffect(() => {
    if (!ready) return;
    // The dictionary is a nice-to-have: a failure leaves the page as it is.
    line = line.then(() => exchange(names, found, rolled, setSaved)).catch(() => {});
  }, [ready, names, found, rolled, setSaved]);

  return sane(stored).items;
}
