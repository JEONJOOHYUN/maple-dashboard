"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { saveRevenueSettings } from "@/app/revenue/actions";
import { AUCTION_FEE_OPTIONS } from "@/lib/boss-split/boss-split-math";
import type { PartyStore } from "@/lib/revenue/calc";
import type { ItemId } from "@/lib/revenue/data";
import { applyPatch, isEmptyPatch, joinPatches, noSettings, patchOf, type Got, type Patch, type Settings } from "@/lib/revenue/settings";
import { clearOld, clearSent, keepUnsent, leftUnsent } from "@/lib/revenue/unsent";
import { useStored } from "@/lib/use-stored";

type Put<T> = (next: T | ((prev: T) => T)) => void;
type PriceText = Partial<Record<ItemId, string>>;
type Unsaved = "" | "failed" | "guest";
type Setters = { setParty: Put<PartyStore>; setGot: Put<Got>; setPriceText: Put<PriceText>; setWithMat: Put<boolean>; setFee: Put<number>; setPicked: Put<string[]>; setAutoPicked: Put<string[]> };

/** What the boss revenue page lets the user set, wherever it is kept. */
export type RevenueSettings = Setters & {
  party: PartyStore;
  got: Got;
  priceText: PriceText;
  withMat: boolean;
  fee: number;
  picked: string[];
  autoPicked: string[];
  /** A member's change that did not reach the account: guest = the session is gone. */
  unsaved: Unsaved;
  saveAgain: () => void;
};

/** How long changes are gathered before they are sent (typing a price is one save, not one a key). */
const SEND_AFTER_MS = 500;

/**
 * A member's settings while the page is open: a change shows at once and is sent a moment later, only what changed
 * (lib/revenue/settings.ts), so a device with an older copy does not undo what another one set. What could not be
 * sent waits for the next try (the next change, "다시", or the next visit).
 */
function accountStore(who: string, start: Settings, first: Patch) {
  // What this member's other pages could not send (lib/revenue/unsent.ts): shown here and sent with this page's
  // first save. Their entries stay where they are until the server has saved them.
  const page = Math.random().toString(36).slice(2);
  const left = stored((store) => leftUnsent(store, who, page, Date.now()));
  let taken = left?.keys ?? [];
  let shown = { value: left ? applyPatch(start, left.patch) : start, unsaved: "" as Unsaved };
  let waiting = left ? joinPatches(first, left.patch) : first;
  /** The patch a request is carrying now: not saved until the server says so. */
  let flying: Patch | null = null;
  let sending = false;
  let timer = 0;
  const listeners = new Set<() => void>();
  /** This page's own entry in the browser ("" = none): what is not saved yet. Kept as it was when there is no room to write. */
  let entry = "";
  const remember = () => {
    entry = stored((store) => keepUnsent(store, who, page, entry, flying ? joinPatches(flying, waiting) : waiting, Date.now())) ?? entry;
  };
  const show = (next: Partial<typeof shown>) => {
    shown = { ...shown, ...next };
    listeners.forEach((l) => l());
  };
  const later = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(send, SEND_AFTER_MS);
  };
  async function send() {
    window.clearTimeout(timer);
    if (sending || isEmptyPatch(waiting)) return;
    sending = true;
    const patch = (flying = waiting);
    waiting = {};
    const result = await saveRevenueSettings(patch).catch(() => "failed" as const);
    sending = false;
    flying = null;
    if (result === "ok") {
      // Everything waiting when this page opened went with its first save: what was read then is saved now.
      const sent = taken;
      taken = [];
      if (sent.length) stored((store) => clearSent(store, sent));
      if (shown.unsaved) show({ unsaved: "" });
      // What changed while this one was on its way.
      if (!isEmptyPatch(waiting)) later();
    } else {
      waiting = joinPatches(patch, waiting);
      show({ unsaved: result });
    }
    remember();
  }
  const put =
    <K extends keyof Settings>(field: K): Put<Settings[K]> =>
    (next) => {
      const before = shown.value;
      const value = typeof next === "function" ? (next as (prev: Settings[K]) => Settings[K])(before[field]) : next;
      if (value === before[field]) return;
      const after = { ...before, [field]: value };
      waiting = joinPatches(waiting, patchOf(before, after));
      remember();
      show({ value: after });
      later();
    };
  const setters: Setters = { setParty: put("party"), setGot: put("got"), setPriceText: put("prices") as Put<PriceText>, setWithMat: put("material"), setFee: put("fee"), setPicked: put("picked"), setAutoPicked: put("autoPicked") };
  return {
    setters,
    send: () => void send(),
    /** Once the page is up: what is waiting (this browser's values for a new account, what other pages left) goes. */
    start() {
      stored((store) => clearOld(store, Date.now()));
      void send();
    },
    get: () => shown,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/** With the browser's storage, or null when it is blocked (the change is still sent, only not kept across a reload). */
function stored<T>(work: (store: Storage) => T): T | null {
  try {
    return work(localStorage);
  } catch {
    return null;
  }
}

const never = () => () => {};
const nothing = () => null;

/**
 * The settings of the boss revenue page. A visitor's live in this browser (localStorage), as before. A signed-in
 * member's live with the account (`member.settings`, read when the page opened). A member who has none there yet
 * starts from what this browser holds, and that goes to the account once; the browser's own copy is left as it is.
 * `member.accounts` = the member's connected NEXON accounts. `member` is read once, when the page mounts.
 */
export function useRevenueSettings(member: { who: string; settings: Settings | null; accounts: string[] } | null): RevenueSettings {
  const [party, setParty] = useStored<PartyStore>("revenue:party", {});
  const [got, setGot] = useStored<Got>("revenue:got", { week: "", marks: {} });
  const [priceText, setPriceText] = useStored<PriceText>("revenue:pricesEok", {});
  const [withMat, setWithMat] = useStored<boolean>("revenue:material", true);
  const [fee, setFee] = useStored<number>("revenue:fee", AUCTION_FEE_OPTIONS[0]);
  const [picked, setPicked] = useStored<string[]>("revenue:picked", []);
  const [autoPicked, setAutoPicked] = useStored<string[]>("revenue:autoPicked", []);

  const [store] = useState(() => {
    if (!member) return null;
    if (member.settings) return accountStore(member.who, member.settings, {});
    // Nothing kept with the account yet: this browser's values, on their way there. Characters already picked
    // here stay as they are (the connected accounts are not picked from again).
    const auto = member.accounts.length ? (picked.length ? member.accounts : []) : autoPicked;
    const here: Settings = { party, prices: priceText as Record<string, string>, got, fee, material: withMat, picked, autoPicked: auto };
    return accountStore(member.who, here, patchOf(noSettings(), here));
  });
  const kept = useSyncExternalStore(store?.subscribe ?? never, store?.get ?? nothing, nothing);
  useEffect(() => {
    if (!store) return;
    store.start();
    // Leaving the page or the tab: what is waiting goes now.
    const leave = () => {
      if (document.visibilityState === "hidden") store.send();
    };
    document.addEventListener("visibilitychange", leave);
    return () => {
      document.removeEventListener("visibilitychange", leave);
      store.send();
    };
  }, [store]);

  if (!store || !kept) return { party, setParty, got, setGot, priceText, setPriceText, withMat, setWithMat, fee, setFee, picked, setPicked, autoPicked, setAutoPicked, unsaved: "", saveAgain: never };
  const s = kept.value;
  return { party: s.party, got: s.got, priceText: s.prices as PriceText, withMat: s.material, fee: s.fee, picked: s.picked, autoPicked: s.autoPicked, ...store.setters, unsaved: kept.unsaved, saveAgain: store.send };
}
