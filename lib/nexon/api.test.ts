import assert from "node:assert/strict";
import { test } from "node:test";
import { nexonGet } from "./api.ts";

test("request starts stay 220 ms apart even when timers fire late (Codex review case)", async () => {
  process.env.NEXON_API_KEY = "test-key";
  const starts: number[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    starts.push(Date.now());
    let first = true;
    // First request: 429 once, so the retry goes through the same queue.
    if (starts.length === 1 && first) {
      first = false;
      return new Response(JSON.stringify({ error: { name: "OPENAPI00007" } }), { status: 429 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;
  try {
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
  assert.equal(starts.length, 7, "6 calls + 1 retry");
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 215, `gap ${i}: ${starts[i] - starts[i - 1]} ms`);
  for (const s of starts) assert.ok(starts.filter((x) => x >= s && x < s + 1000).length <= 5, "at most 5 starts in any 1 s window");
});
