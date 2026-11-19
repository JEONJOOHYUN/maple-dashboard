import assert from "node:assert/strict";
import { test } from "node:test";
import { nexonGet, nexonGetBulk } from "./api.ts";

// Its own file so the module's pace starts fresh (each test file runs in its own process). The tests share it, so
// their order matters.

const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
const refused = () => new Response(JSON.stringify({ error: { name: "OPENAPI00007" } }), { status: 429 });

async function withFetch(reply: (n: number) => Response, run: () => Promise<unknown>): Promise<number[]> {
  process.env.NEXON_API_KEY = "test-key";
  const starts: number[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    starts.push(Date.now());
    return reply(starts.length);
  }) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = realFetch;
  }
  return starts;
}

// Starts in the busiest window of `ms` milliseconds.
const busiest = (starts: number[], ms: number) => Math.max(...starts.map((s) => starts.filter((x) => x >= s && x < s + ms).length));

test("guild calls are paced: 250 a second on average, 25 together at most", async () => {
  const starts = await withFetch(ok, () => Promise.all(Array.from({ length: 300 }, (_, i) => nexonGetBulk("character/basic", { ocid: String(i) }))));
  assert.equal(starts.length, 300);
  // 25 at once, the other 275 at 250 a second.
  const span = starts[299] - starts[0];
  assert.ok(span >= 1050, `300 starts over ${span} ms`);
  assert.ok(span < 1600, `the rate is reached even with coarse timers: ${span} ms`);
  assert.ok(busiest(starts, 1000) <= 275, `busiest second: ${busiest(starts, 1000)}`);
});

test("guild calls stay paced when the server was busy and every timer fires late", async () => {
  const starts = await withFetch(ok, async () => {
    const calls = Array.from({ length: 120 }, (_, i) => nexonGetBulk("character/basic", { ocid: `late${i}` }));
    const until = Date.now() + 400;
    while (Date.now() < until) {
      /* busy wait: every pending timer is late */
    }
    await Promise.all(calls);
  });
  assert.equal(starts.length, 120);
  assert.ok(busiest(starts, 100) <= 25 + 25 + 2, `busiest 100 ms: ${busiest(starts, 100)}`);
});

test("a refused guild call waits and tries again, and does not slow everyone else", async () => {
  const bulk = await withFetch((n) => (n === 1 ? refused() : ok()), () => nexonGetBulk("character/basic", { ocid: "x" }));
  assert.equal(bulk.length, 2, "refused + retry");
  assert.ok(bulk[1] - bulk[0] >= 1000, `retried after ${bulk[1] - bulk[0]} ms`);
  // The ordinary calls right after are still not spaced.
  const starts = await withFetch(ok, () => Promise.all(Array.from({ length: 13 }, (_, i) => nexonGet("character/basic", { ocid: String(i) }))));
  assert.ok(Math.max(...starts) - Math.min(...starts) < 150, `13 starts within ${Math.max(...starts) - Math.min(...starts)} ms`);
});

test("an ordinary refusal slows the ordinary calls for a minute, not for good", async () => {
  await withFetch((n) => (n === 1 ? refused() : ok()), () => nexonGet("character/basic", { ocid: "first" }));
  const spaced = await withFetch(ok, () => Promise.all([0, 1, 2].map((i) => nexonGet("character/basic", { ocid: String(i) }))));
  assert.ok(spaced[2] - spaced[0] >= 2 * 215, "spaced right after the refusal");
  const realNow = Date.now;
  Date.now = () => realNow() + 61_000;
  try {
    const fast = await withFetch(ok, () => Promise.all(Array.from({ length: 13 }, (_, i) => nexonGet("character/basic", { ocid: String(i) }))));
    assert.ok(Math.max(...fast) - Math.min(...fast) < 150, "back to full speed a minute later");
  } finally {
    Date.now = realNow;
  }
});
