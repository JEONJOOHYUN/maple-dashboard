// A member's boss revenue changes that have not reached the account yet, kept in the browser until they do: a reload
// or a closed tab right after a change must not lose it (a request started while the page goes away may never
// arrive).
// An entry is never changed once written: a page writes what it still has to send under a new key each time and
// then drops its previous one. So another page of the member can read the entries, send them again, and clear
// exactly the keys it read once the server has saved them; whatever was written since sits under a key it never
// saw. Nothing is cleared before it is saved, and no check-then-clear can be overtaken by another tab's write.
// Pure: the storage is handed in (localStorage in the page, a map in the tests).
import { cleanPatch, isEmptyPatch, joinPatches, type Patch } from "./settings.ts";

const PREFIX = "revenue:unsent:";
/** After a day they are dropped: by then another device may have set the same thing again. */
const KEEP_MS = 24 * 3_600_000;

export type UnsentStore = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;

/**
 * The keys of one open page: "revenue:unsent:<member>:<page>:<n>". n goes up with every write of this tab and never
 * comes back (not after the page has nothing left to send either): a key that was cleared late by another tab must
 * not be one that holds something new.
 */
let writes = 0;
const pageKeys = (who: string, page: string) => `${PREFIX}${who}:${page}:`;

/** Every entry in the storage: whose it is, when it was written and (when well formed) what it holds. */
function entries(store: UnsentStore): { key: string; who: string; at: number; patch: Patch | null }[] {
  const out = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    let at = 0;
    let patch: Patch | null = null;
    try {
      const kept = JSON.parse(store.getItem(key) ?? "null") as { at?: unknown; patch?: unknown } | null;
      if (typeof kept?.at === "number") at = kept.at;
      patch = cleanPatch(kept?.patch);
    } catch {
      // Not readable: it goes with the old ones (clearOld).
    }
    out.push({ key, who: key.slice(PREFIX.length).split(":")[0], at, patch });
  }
  return out;
}

/**
 * What other pages of this member left unsent, oldest first, as one patch, and the keys it was read from (for
 * `clearSent`). Reads only.
 */
export function leftUnsent(store: UnsentStore, who: string, page: string, now: number): { patch: Patch; keys: string[] } | null {
  const own = pageKeys(who, page);
  const left = entries(store)
    .filter((e) => e.who === who && !e.key.startsWith(own) && e.patch && !isEmptyPatch(e.patch) && now - e.at <= KEEP_MS)
    .sort((a, b) => a.at - b.at);
  if (!left.length) return null;
  return { patch: left.reduce<Patch>((all, e) => joinPatches(all, e.patch as Patch), {}), keys: left.map((e) => e.key) };
}

/** The server has saved what was read under these keys: they go (what a page wrote since is under another key). */
export function clearSent(store: UnsentStore, keys: string[]): void {
  for (const key of keys) store.removeItem(key);
}

/** Entries past their day go, whoever left them. */
export function clearOld(store: UnsentStore, now: number): void {
  for (const e of entries(store)) if (now - e.at > KEEP_MS) store.removeItem(e.key);
}

/**
 * Keeps what this page still has to send: written under a new key, then the page's previous entry (`last`) goes.
 * Returns the key now in use ("" = nothing left to send). When there is no room to write, it throws and the
 * previous entry stays.
 */
export function keepUnsent(store: UnsentStore, who: string, page: string, last: string, patch: Patch, now: number): string {
  let key = "";
  if (!isEmptyPatch(patch)) {
    key = `${pageKeys(who, page)}${++writes}`;
    store.setItem(key, JSON.stringify({ at: now, patch }));
  }
  if (last) store.removeItem(last);
  return key;
}
