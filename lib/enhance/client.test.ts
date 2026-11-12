import assert from "node:assert/strict";
import { test } from "node:test";
import { createApi, forgetPace } from "./client.ts";

// A stand-in for the browser's storage and for NEXON: `limit` request starts a second, anything above gets
// "too many requests" (OPENAPI00007) the way a development-stage key does.
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
});

function fakeNexon(limit: number) {
  const starts: number[] = [];
  const refused: number[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    const now = Date.now();
    starts.push(now);
    const inLastSecond = starts.filter((t) => now - t < 1000).length;
    if (inLastSecond > limit) {
      refused.push(now);
      return { ok: false, status: 429, json: async () => ({ error: { name: "OPENAPI00007" } }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  }) as unknown as typeof fetch;
  return { starts, refused, restore: () => void (globalThis.fetch = realFetch) };
}

const gaps = (times: number[]) => times.slice(1).map((t, i) => t - times[i]);

test("pace: a service-stage key is called close together and nothing is remembered", async () => {
  store.clear();
  const nexon = fakeNexon(500);
  try {
    const api = createApi("service-key", "svc");
    const began = Date.now();
    await Promise.all(Array.from({ length: 30 }, (_, i) => api.get("history/starforce", { date: String(i) })));
    // 30 calls 10 ms apart: well under a second (the development pace would take about 7).
    assert.ok(Date.now() - began < 1500, `took ${Date.now() - began} ms`);
    assert.equal(nexon.refused.length, 0);
    assert.equal(store.get("enhance:pace:svc"), undefined);
  } finally {
    nexon.restore();
  }
});

test("pace: a development-stage key drops to 5 a second at the first refusal, and the browser remembers", async () => {
  store.clear();
  const nexon = fakeNexon(5);
  try {
    const api = createApi("dev-key", "dev");
    // Twelve at once, as the sync does: every one of them is answered in the end.
    const answers = await Promise.all(Array.from({ length: 12 }, (_, i) => api.get<{ ok: boolean }>("history/starforce", { date: String(i) })));
    assert.ok(answers.every((a) => a.ok));
    assert.ok(nexon.refused.length > 0, "the burst was refused at least once");
    assert.equal(store.get("enhance:pace:dev"), "slow");
    // After the first refusal no two request starts are closer than the development pace.
    const after = nexon.starts.filter((t) => t > nexon.refused[0]);
    assert.ok(after.length > 0 && gaps(after).every((g) => g >= 200), `gaps ${gaps(after).join(",")}`);
    const refusedBefore = nexon.refused.length;

    // The next visit (the last second of calls is long over) starts at that pace straight away: no refusal at all.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const again = createApi("dev-key", "dev");
    const from = nexon.starts.length;
    await Promise.all(Array.from({ length: 4 }, (_, i) => again.get("history/starforce", { date: String(i) })));
    assert.ok(gaps(nexon.starts.slice(from)).every((g) => g >= 200), `gaps ${gaps(nexon.starts.slice(from)).join(",")}`);
    assert.equal(nexon.refused.length, refusedBefore);

    // Deleting the key forgets its pace.
    forgetPace("dev");
    assert.equal(store.get("enhance:pace:dev"), undefined);
  } finally {
    nexon.restore();
  }
});
