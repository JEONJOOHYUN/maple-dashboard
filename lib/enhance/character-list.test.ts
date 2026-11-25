import assert from "node:assert/strict";
import { test } from "node:test";
import { characterList, createApi, fetchCharacters, fetchMainCharacter } from "./client.ts";

const LIST = { account_list: [{ character_list: [{ ocid: "o1", character_name: "가", world_name: "스카니아", character_class: "비숍", character_level: 280 }] }] };

/** NEXON stand-in: counts character/list calls per key; `fail` answers the next one with a 500. */
function fakeNexon() {
  const calls: Record<string, number> = {};
  let fail = false;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const key = (init?.headers as Record<string, string>)["x-nxopen-api-key"];
    if (String(url).includes("character/list")) calls[key] = (calls[key] ?? 0) + 1;
    if (fail) {
      fail = false;
      return new Response(JSON.stringify({ error: { name: "OPENAPI00001" } }), { status: 500 });
    }
    return new Response(JSON.stringify(LIST), { status: 200 });
  }) as typeof fetch;
  return { calls, failNext: () => (fail = true) };
}

test("character/list: the key check, the key's name and the worlds of one key share one call", async () => {
  const nexon = fakeNexon();
  const [a, b, c] = await Promise.all([characterList(createApi("k-share")), fetchMainCharacter(createApi("k-share", "acc")), fetchCharacters(createApi("k-share", "acc"))]);
  assert.deepEqual(a, LIST);
  assert.equal(b, "가");
  assert.deepEqual(c.worlds, { 가: "스카니아" });
  // Asked again a moment later: still the kept answer.
  await characterList(createApi("k-share"));
  assert.equal(nexon.calls["k-share"], 1);
  // Another key has its own.
  await characterList(createApi("k-other"));
  assert.equal(nexon.calls["k-other"], 1);
});

test("character/list: a failure is not kept, the next caller asks again", async () => {
  const nexon = fakeNexon();
  nexon.failNext();
  await assert.rejects(characterList(createApi("k-fail")));
  assert.deepEqual(await characterList(createApi("k-fail")), LIST);
  assert.equal(nexon.calls["k-fail"], 2);
});

test("character/list: a caller that gives up is told at once, the shared call goes on for the others", async () => {
  fakeNexon();
  const stop = new AbortController();
  const mine = characterList(createApi("k-abort"), stop.signal);
  const theirs = characterList(createApi("k-abort"));
  stop.abort(new Error("gave up"));
  await assert.rejects(mine, /gave up/);
  assert.deepEqual(await theirs, LIST);
});
