import assert from "node:assert/strict";
import { test } from "node:test";
import { NexonError, nexonUnionMain } from "./api.ts";

// Half past midnight in Korea: yesterday's ranking may still be in the making.
const NOW = Date.parse("2026-11-20T00:30:00+09:00");

/** A stand-in for nexonGet: the reply (or error) for each ranking date, and the dates asked. */
function fake(replies: Record<string, unknown>) {
  const asked: string[] = [];
  const get = (async (path: string, params: Record<string, string>) => {
    asked.push(`${path} ${params.date}`);
    const r = replies[params.date];
    if (r instanceof Error) throw r;
    return r;
  }) as Parameters<typeof nexonUnionMain>[1];
  return { get, asked };
}
const failed = (code: string) => new NexonError("failed", code, code);

test("union main: yesterday's union ranking (KST) names the main", async () => {
  const { get, asked } = fake({ "2026-11-19": { ranking: [{ character_name: "개옵" }] } });
  assert.equal(await nexonUnionMain("o", get, NOW), "개옵");
  assert.deepEqual(asked, ["ranking/union 2026-11-19"]);
});

test("union main: the day before while yesterday's is still being made", async () => {
  const { get, asked } = fake({ "2026-11-19": failed("OPENAPI00009"), "2026-11-18": { ranking: [{ character_name: "개옵" }] } });
  assert.equal(await nexonUnionMain("o", get, NOW), "개옵");
  assert.deepEqual(asked, ["ranking/union 2026-11-19", "ranking/union 2026-11-18"]);
});

test("union main: no row is no main; NEXON failing is a failure", async () => {
  assert.equal(await nexonUnionMain("o", fake({ "2026-11-19": { ranking: [] } }).get, NOW), null);
  assert.equal(await nexonUnionMain("o", fake({ "2026-11-19": failed("OPENAPI00004") }).get, NOW), null);
  await assert.rejects(nexonUnionMain("o", fake({ "2026-11-19": failed("OPENAPI00001") }).get, NOW));
  await assert.rejects(nexonUnionMain("o", fake({ "2026-11-19": new NexonError("quota", "x", "OPENAPI00007") }).get, NOW));
});
