import { test } from "node:test";
import assert from "node:assert/strict";
import { FAST, SLOW, once, pacer, pacerPool } from "./open-api.ts";

/** A clock that only moves when a caller waits: the starts are then exactly what the limit allows. */
function clockAt(start: number) {
  let now = start;
  return { now: () => now, sleep: async (ms: number) => void (now += ms), skip: (ms: number) => void (now += ms) };
}
const turns = (line: ReturnType<typeof pacer>, n: number) => Promise.all(Array.from({ length: n }, () => line.turn()));
/** No more than `burst` starts within a window: each start is at least a window after the one `burst` places before. */
const keepsLimit = (starts: number[], burst: number, windowMs: number) => starts.every((s, i) => i < burst || s - starts[i - burst] >= windowMs);

test("five starts go at once, the next five a window later, in the order asked", async () => {
  const starts = await turns(pacer({ burst: 5, windowMs: 1100 }, clockAt(1000)), 12);
  assert.deepEqual(starts, [1000, 1000, 1000, 1000, 1000, 2100, 2100, 2100, 2100, 2100, 3200, 3200]);
  assert.ok(keepsLimit(starts, 5, 1100));
});

test("a retry after a refusal waits its back-off, behind everything already waiting", async () => {
  // Few waiting: the back-off decides.
  const short = pacer({ burst: 5, windowMs: 1100 }, clockAt(1000));
  await short.turn();
  short.backOff(1200);
  assert.equal(await short.turn(), 2200);
  // Twelve went (the last two at 3200): the retry starts its back-off later, and the calls after it keep the limit.
  const long = pacer({ burst: 5, windowMs: 1100 }, clockAt(1000));
  const starts = await turns(long, 12);
  long.backOff(1200);
  const after = await turns(long, 7);
  assert.deepEqual(after, [4400, 4400, 4400, 4400, 4400, 5500, 5500]);
  assert.ok(keepsLimit([...starts, ...after], 5, 1100));
});

test("a line made tighter spaces every start after the ones already given, and counts the recent ones", async () => {
  // Service-stage pace: twelve characters start together.
  const clock = clockAt(1000);
  const line = pacer(FAST, clock);
  assert.deepEqual(await turns(line, 12), Array(12).fill(1000));
  assert.equal(line.recent(1000), 12);
  // NEXON refused (a development-stage key): one start every 230 ms from the last one, after the back-off.
  line.limitTo(SLOW);
  assert.deepEqual(await turns(line, 3), [1230, 1460, 1690]);
  line.backOff(1200);
  assert.deepEqual(await turns(line, 2), [2890, 3120]);
  // And loose again (our own key goes back to the fast pace a minute after a refusal).
  line.limitTo(FAST);
  assert.deepEqual(await turns(line, 3), [3120, 3120, 3120]);
  clock.skip(5000);
  assert.equal(line.recent(1000), 0);
});

test("back to the fast limit, the starts of the slow second still count", async () => {
  // Five starts at the development pace, then the service pace again: the 250 of that second include those five.
  const line = pacer(SLOW, clockAt(1000));
  const slow = await turns(line, 5);
  assert.deepEqual(slow, [1000, 1230, 1460, 1690, 1920]);
  line.limitTo(FAST);
  const fast = await turns(line, 260);
  assert.equal(fast[244], 1920);
  assert.equal(fast[245], 2000);
  assert.ok(keepsLimit([...slow, ...fast], 250, 1000));
});

test("a limit set for a while ends for the callers already waiting too", async () => {
  // Our own key: refused, so a minute at the slow pace. 300 calls are already in line; nobody asks again.
  const line = pacer(FAST, clockAt(1000));
  line.limitTo(SLOW, 60_000);
  const starts = await turns(line, 300);
  assert.equal(starts[1] - starts[0], 230);
  // The minute ends at 61 000: the start that waited past it is the last slow one, the rest go together.
  assert.equal(starts[260], 60_800);
  assert.equal(starts[261], 61_030);
  assert.ok(starts.slice(262).every((s) => s === 61_030));
});

test("a caller that gives up leaves the line: the next one does not wait for it", async () => {
  // Real time: a refusal held the line, forty calls wait in it, then the visitor leaves the page.
  const line = pacer({ burst: 1, windowMs: 60 });
  await line.turn();
  line.backOff(250);
  const leaving = new AbortController();
  const waiting = Array.from({ length: 40 }, () => line.turn(leaving.signal));
  const from = Date.now();
  leaving.abort(new Error("left"));
  for (const w of waiting) await assert.rejects(w, /left/);
  // The next call waits out what is left of the back-off, not forty more gaps (2.4 s), and only it is counted.
  await line.turn();
  assert.ok(Date.now() - from < 600, `waited ${Date.now() - from} ms`);
  assert.equal(line.recent(1000), 2);
});

test("a caller that gives up behind one still waiting is told at once", async () => {
  const line = pacer({ burst: 1, windowMs: 60 });
  await line.turn();
  line.backOff(300);
  // The first waits out the back-off; the second, behind it, gives up.
  const first = line.turn();
  const leaving = new AbortController();
  const second = line.turn(leaving.signal);
  const from = Date.now();
  leaving.abort(new Error("left"));
  await assert.rejects(second, /left/);
  assert.ok(Date.now() - from < 100, `told after ${Date.now() - from} ms`);
  // The first still gets its turn, and the one that left is not counted.
  await first;
  assert.ok(Date.now() - from >= 250);
  assert.equal(line.recent(1000), 2);
});

test("two requests for the same key share one line; an idle line is dropped", async () => {
  const clock = clockAt(1000);
  const lineOf = pacerPool({ burst: 2, windowMs: 1100 }, 60_000, clock);
  // Two requests (two tabs) take turns from the same line; another key has its own.
  assert.deepEqual(await Promise.all([lineOf("a").turn(), lineOf("a").turn(), lineOf("b").turn(), lineOf("a").turn()]), [1000, 1000, 1000, 2100]);
  assert.equal(lineOf("a"), lineOf("a"));
  // After a minute without use the line is a new one (the old starts are long past by then).
  const old = lineOf("a");
  clock.skip(60_001);
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
