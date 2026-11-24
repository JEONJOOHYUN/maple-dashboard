import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPick, packPick, startingPick } from "./pick.ts";

const a = "a".repeat(32);
const b = "b".repeat(64);
const c = "0123456789abcdef".repeat(2);

test("a pick goes into the cookie and comes back the same", () => {
  assert.deepEqual(cleanPick(packPick([a, b, c]), 36), [a, b, c]);
  assert.deepEqual(cleanPick(packPick([]), 36), []);
});

test("only well-formed ids are kept, each once, up to the limit", () => {
  assert.deepEqual(cleanPick([a, "nope", a, b.toUpperCase(), "a".repeat(31), 7, null, b], 36), [a, b]);
  assert.deepEqual(cleanPick(`${a}.${b}.${c}`, 2), [a, b]);
  for (const junk of [undefined, null, 5, {}, "", "..", "<script>"]) assert.deepEqual(cleanPick(junk, 36), []);
});

test("the picker opens with the member's own pick, whatever the page showed before", () => {
  // The page was drawn while the list failed (nothing on show); the picker then reads the pick again.
  assert.deepEqual(startingPick({ picking: true, picked: [a, b] }, []), [a, b]);
  assert.deepEqual(startingPick({ picking: true, picked: [a] }, [b, c]), [a]);
  // No pick of the member's own: the characters on show are the starting point.
  assert.deepEqual(startingPick({ picking: false, picked: [a, b, c] }, [b]), [b]);
  assert.deepEqual(startingPick({ picking: false, picked: [a] }, []), []);
});
