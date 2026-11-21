import assert from "node:assert/strict";
import { test } from "node:test";
import { NexonError, liveOrYesterday, nexonGet } from "./api.ts";
import { asOfLabel } from "../spec/as-of.ts";

// NEXON under maintenance (user, 2026-11-20): live data is refused, the same call with yesterday's date still answers.

/** Replaces fetch for one test: `reply(url)` is the body and status, every url asked is kept. */
async function withFetch<T>(reply: (url: URL) => { status: number; body: unknown }, run: (asked: string[]) => Promise<T>): Promise<T> {
  process.env.NEXON_API_KEY = "test-key";
  const asked: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    asked.push(`${url.pathname.replace("/maplestory/v1/", "")}${url.search}`);
    const r = reply(url);
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
  try {
    return await run(asked);
  } finally {
    globalThis.fetch = realFetch;
  }
}
const refused = (code: string) => ({ status: 400, body: { error: { name: code, message: "x" } } });
const kindOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof NexonError ? `${e.kind} ${e.code}` : "other";
  }
};

test("maintenance answers are their own kind; other refusals stay failures", async () => {
  await withFetch(
    (url) => refused(url.searchParams.get("ocid") ?? ""),
    async () => {
      assert.equal(await kindOf(nexonGet("character/a", { ocid: "OPENAPI00009" })), "maintenance OPENAPI00009");
      assert.equal(await kindOf(nexonGet("character/b", { ocid: "OPENAPI00010" })), "maintenance OPENAPI00010");
      // The API itself under maintenance: nothing answers, dated or not.
      assert.equal(await kindOf(nexonGet("character/c", { ocid: "OPENAPI00011" })), "failed OPENAPI00011");
      assert.equal(await kindOf(nexonGet("character/d", { ocid: "OPENAPI00004" })), "failed OPENAPI00004");
    },
  );
});

test("an endpoint under maintenance is not asked for live data again at once, a dated call always is", async () => {
  await withFetch(
    (url) => (url.searchParams.has("date") ? { status: 200, body: { day: url.searchParams.get("date") } } : refused("OPENAPI00010")),
    async (asked) => {
      assert.equal(await kindOf(nexonGet("character/skill", { ocid: "1" })), "maintenance OPENAPI00010");
      // A whole guild's worth of the same call: none of them leaves.
      for (let i = 0; i < 50; i++) assert.equal(await kindOf(nexonGet("character/skill", { ocid: String(i) })), "maintenance OPENAPI00010");
      assert.equal(asked.length, 1);
      assert.deepEqual(await nexonGet("character/skill", { ocid: "1", date: "2026-11-19" }), { day: "2026-11-19" });
      // Another endpoint has not said anything yet: it is asked.
      assert.equal(await kindOf(nexonGet("character/basic", { ocid: "1" })), "maintenance OPENAPI00010");
      assert.deepEqual(asked, ["character/skill?ocid=1", "character/skill?ocid=1&date=2026-11-19", "character/basic?ocid=1"]);
    },
  );
});

test("a dated call that is refused does not close the live one (the ranking right after midnight)", async () => {
  await withFetch(
    (url) => (url.searchParams.has("date") ? refused("OPENAPI00009") : { status: 200, body: { live: true } }),
    async (asked) => {
      assert.equal(await kindOf(nexonGet("ranking/union", { ocid: "1", date: "2026-11-19" })), "maintenance OPENAPI00009");
      assert.deepEqual(await nexonGet("ranking/union", { ocid: "1" }), { live: true });
      assert.equal(asked.length, 2);
    },
  );
});

// Half past ten in the morning in Korea, a Thursday.
const NOW = Date.parse("2026-11-26T10:30:00+09:00");
const maintenance = () => new NexonError("maintenance", "x", "OPENAPI00010");

test("liveOrYesterday: live when it answers, yesterday's (KST) under maintenance, the day before while that is being made", async () => {
  const asked: string[] = [];
  const dated = (answer: (date: string) => unknown) => async (date: string) => {
    asked.push(date);
    const r = answer(date);
    if (r instanceof Error) throw r;
    return r;
  };
  assert.equal(await liveOrYesterday(async () => "live", dated(() => "dated"), NOW), "live");
  assert.deepEqual(asked, []);

  assert.equal(await liveOrYesterday(async () => Promise.reject(maintenance()), dated((d) => `of ${d}`), NOW), "of 2026-11-25");
  assert.deepEqual(asked.splice(0), ["2026-11-25"]);

  const stillMaking = (d: string) => (d === "2026-11-25" ? new NexonError("maintenance", "x", "OPENAPI00009") : `of ${d}`);
  assert.equal(await liveOrYesterday(async () => Promise.reject(maintenance()), dated(stillMaking), NOW), "of 2026-11-24");
  assert.deepEqual(asked.splice(0), ["2026-11-25", "2026-11-24"]);

  // Just after midnight in Korea "yesterday" is the Korean one, not the server's.
  const justAfterMidnight = Date.parse("2026-11-26T00:10:00+09:00");
  assert.equal(await liveOrYesterday(async () => Promise.reject(maintenance()), dated((d) => d), justAfterMidnight), "2026-11-25");
  asked.splice(0);
});

test("liveOrYesterday: anything but maintenance is thrown as it is, from either side", async () => {
  const quota = new NexonError("quota", "x", "OPENAPI00007");
  await assert.rejects(liveOrYesterday(async () => Promise.reject(quota), async () => "dated", NOW), (e) => e === quota);
  await assert.rejects(liveOrYesterday(async () => Promise.reject(maintenance()), async () => Promise.reject(quota), NOW), (e) => e === quota);
  // Not even the day before answers: the maintenance error reaches the page, which says so.
  await assert.rejects(
    liveOrYesterday(async () => Promise.reject(maintenance()), async () => Promise.reject(maintenance()), NOW),
    (e) => e instanceof NexonError && e.kind === "maintenance",
  );
});

test("the line on the page: the date the data is of", () => {
  assert.equal(asOfLabel("2026-11-19"), "11/19 데이터 · 넥슨 점검 중");
  assert.equal(asOfLabel("2027-01-03"), "1/3 데이터 · 넥슨 점검 중");
});
