import { test } from "node:test";
import assert from "node:assert/strict";
import { once, pacer, pacerPool } from "./pace.ts";

// A clock that stands still: only the starts handed out matter.
const still = { now: () => 1000, sleep: async () => {} };

test("request starts are a gap apart, in the order asked", async () => {
  const p = pacer(220, still);
  assert.deepEqual(await Promise.all([p.turn(), p.turn(), p.turn(), p.turn()]), [1000, 1220, 1440, 1660]);
});

test("a retry after a refusal waits its back-off and starts after everything already waiting", async () => {
  // Few waiting: the back-off decides.
  const short = pacer(220, still);
  await short.turn();
  short.backOff(1200);
  assert.equal(await short.turn(), 2200);
  // Twelve waiting (the last starts at 1000 + 11 × 220): the retry goes behind them, not into the middle.
  const long = pacer(220, still);
  const starts = await Promise.all(Array.from({ length: 12 }, () => long.turn()));
  long.backOff(1200);
  const retry = await long.turn();
  assert.equal(retry, 1000 + 12 * 220);
  for (const s of starts) assert.ok(retry - s >= 220);
  // And the calls after the retry keep the gap.
  assert.equal(await long.turn(), retry + 220);
});

test("two requests for the same key share one line; an idle line is dropped", async () => {
  let now = 1000;
  const clock = { now: () => now, sleep: async () => {} };
  const lineOf = pacerPool(220, 60_000, clock);
  // Two requests (two tabs) take turns from the same line; another key has its own.
  assert.deepEqual(await Promise.all([lineOf("a").turn(), lineOf("a").turn(), lineOf("b").turn(), lineOf("a").turn()]), [1000, 1220, 1000, 1440]);
  assert.equal(lineOf("a"), lineOf("a"));
  // After a minute without use the line is a new one (the old starts are long past by then).
  const old = lineOf("a");
  now += 60_001;
  lineOf("b");
  assert.notEqual(lineOf("a"), old);
});

test("the same work asked for twice at once runs once", async () => {
  const running = new Map<string, Promise<unknown>>();
  let runs = 0;
  let finish: (value: string) => void = () => {};
  const work = () => {
    runs++;
    return new Promise<string>((resolve) => (finish = resolve));
  };
  const first = once(running, "k", work);
  const second = once(running, "k", work);
  const other = once(running, "other", async () => "x");
  finish("done");
  assert.deepEqual(await Promise.all([first, second, other]), ["done", "done", "x"]);
  assert.equal(runs, 1);
  // Finished: the next one runs again, and a failure is not kept either.
  await assert.rejects(once(running, "k", async () => Promise.reject(new Error("no"))));
  assert.equal(await once(running, "k", async () => "again"), "again");
  assert.equal(running.size, 0);
});
