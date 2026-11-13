import assert from "node:assert/strict";
import { test } from "node:test";
import { nexonGet } from "./api.ts";

// The two tests share the module's pace, so their order matters: fast first, then the refusal that slows it.

test("service-stage key: request starts are not spaced", async () => {
  process.env.NEXON_API_KEY = "test-key";
  const starts: number[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    starts.push(Date.now());
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;
  try {
    await Promise.all(Array.from({ length: 13 }, (_, i) => nexonGet("character/basic", { ocid: String(i) })));
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(starts.length, 13);
  assert.ok(Math.max(...starts) - Math.min(...starts) < 150, `13 starts within ${Math.max(...starts) - Math.min(...starts)} ms`);
});

test("a refusal drops to the spaced pace: starts 220 ms apart even when timers fire late (Codex review case)", async () => {
  process.env.NEXON_API_KEY = "test-key";
  const starts: number[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    starts.push(Date.now());
    // The very first request is refused once (what a development-stage key does to a burst).
    if (starts.length === 1) return new Response(JSON.stringify({ error: { name: "OPENAPI00007" } }), { status: 429 });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;
  try {
    // The refusal and its retry.
    await nexonGet("character/basic", { ocid: "first" });
    const calls = Array.from({ length: 6 }, (_, i) => nexonGet("character/basic", { ocid: String(i) }));
    // Block the event loop for 1.2 s so every pending timer is late.
    const until = Date.now() + 1200;
    while (Date.now() < until) {
      /* busy wait */
    }
    await Promise.all(calls);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(starts.length, 8, "refused + retry + 6 calls");
  const spaced = starts.slice(1);
  for (let i = 1; i < spaced.length; i++) assert.ok(spaced[i] - spaced[i - 1] >= 215, `gap ${i}: ${spaced[i] - spaced[i - 1]} ms`);
  for (const s of spaced) assert.ok(spaced.filter((x) => x >= s && x < s + 1000).length <= 5, "at most 5 starts in any 1 s window");
});
