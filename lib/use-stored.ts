"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Per-browser state in localStorage (guests' own numbers). Server render and private windows fall back
// to the initial value; every read and write is wrapped because storage can throw.
const EVENT = "maple-stored-change";
const memory = new Map<string, string>();
/** Keys whose last write went to memory (storage full or blocked); reads must use memory too. */
const inMemory = new Set<string>();

function read(key: string): string | null {
  if (inMemory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    inMemory.delete(key);
  } catch {
    memory.set(key, value);
    inMemory.add(key);
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

/** [value, set] backed by localStorage under `key` (JSON). */
export function useStored<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
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
      const prevRaw = read(key);
      let prev = initial;
      if (prevRaw !== null) {
        try {
          prev = JSON.parse(prevRaw) as T;
        } catch {
          // keep initial
        }
      }
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      write(key, JSON.stringify(resolved));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );
  return [value, set];
}
