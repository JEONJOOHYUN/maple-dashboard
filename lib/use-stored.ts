"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Per-browser state in localStorage (guests' own numbers), or per tab in sessionStorage (what a screen was showing,
// to come back to). Server render and private windows fall back to the initial value; every read and write is
// wrapped because storage can throw.
const EVENT = "maple-stored-change";
export type StoreArea = "local" | "session";
const memory = new Map<string, string>();
/** Keys whose last write went to memory (storage full or blocked); reads must use memory too. */
const inMemory = new Set<string>();
const storage = (area: StoreArea) => (area === "session" ? window.sessionStorage : window.localStorage);

function read(key: string, area: StoreArea): string | null {
  const slot = `${area}:${key}`;
  if (inMemory.has(slot)) return memory.get(slot) ?? null;
  try {
    return storage(area).getItem(key);
  } catch {
    return memory.get(slot) ?? null;
  }
}

function write(key: string, value: string, area: StoreArea) {
  const slot = `${area}:${key}`;
  try {
    storage(area).setItem(key, value);
    inMemory.delete(slot);
  } catch {
    memory.set(slot, value);
    inMemory.add(slot);
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** [value, set] backed by localStorage (or this tab's sessionStorage) under `key` (JSON). */
export function useStored<T>(key: string, initial: T, area: StoreArea = "local"): [T, (next: T | ((prev: T) => T)) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key, area),
    () => null
  );
  const value = useMemo<T>(() => {
    if (raw === null) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
    // `initial` is a fresh literal each render; only the stored text matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prevRaw = read(key, area);
      let prev = initial;
      if (prevRaw !== null) {
        try {
          prev = JSON.parse(prevRaw) as T;
        } catch {
          // keep initial
        }
      }
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      write(key, JSON.stringify(resolved), area);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, area]
  );
  return [value, set];
}
