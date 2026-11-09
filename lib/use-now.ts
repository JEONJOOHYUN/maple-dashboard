"use client";

import { useSyncExternalStore } from "react";

// Shared clock that ticks every 30 s. The server snapshot is 0 so time-dependent text renders on the client only.
let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Current time in ms, or 0 during server render / before hydration. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => (now === 0 ? (now = Date.now()) : now),
    () => 0
  );
}
