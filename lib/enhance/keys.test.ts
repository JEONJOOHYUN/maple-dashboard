import assert from "node:assert/strict";
import { test } from "node:test";
import { mainCharacter } from "./client.ts";
import { keyLabel, withKey, withName, withoutKey, type SavedKey } from "./keys.ts";

const mine: SavedKey = { key: "key-a", account: "aaaa" };
const friend: SavedKey = { key: "key-b", account: "bbbb" };

test("saved keys: one entry per account, added at the end", () => {
  const one = withKey([], mine);
  const two = withKey(one, friend);
  assert.deepEqual(two, [mine, friend]);
  // The same account again does not make a second entry.
  assert.deepEqual(withKey(two, mine), two);
  // A new key for the same account (reissued) takes the place of the old one and keeps the name.
  const named = withName(two, "aaaa", "내캐릭터");
  assert.deepEqual(withKey(named, { key: "key-a2", account: "aaaa" }), [{ key: "key-a2", account: "aaaa", name: "내캐릭터" }, friend]);
});

test("saved keys: removing one leaves the others", () => {
  assert.deepEqual(withoutKey([mine, friend], "aaaa"), [friend]);
  assert.deepEqual(withoutKey([mine], "cccc"), [mine]);
});

test("saved keys: named once, after a character of the account", () => {
  const list = [mine, friend];
  const named = withName(list, "bbbb", "친구캐릭터");
  assert.deepEqual(named, [mine, { ...friend, name: "친구캐릭터" }]);
  // The first name stays, and nothing changes for an unknown account or an empty name.
  assert.equal(withName(named, "bbbb", "다른캐릭터"), named);
  assert.equal(withName(list, "cccc", "누구"), list);
  assert.equal(withName(list, "aaaa", ""), list);
});

test("saved keys: the name is the account's highest-level character", () => {
  // The shape NEXON answered with on 2026-11-12 (names made up).
  const body = { account_list: [{ account_id: "x", character_list: [{ character_name: "부캐", character_level: 260 }, { character_name: "본캐", character_level: 298 }, { character_name: "창고", character_level: 12 }] }] };
  assert.equal(mainCharacter(body), "본캐");
  // The first one wins a tie; an empty or odd answer names nothing.
  assert.equal(mainCharacter({ account_list: [{ character_list: [{ character_name: "가", character_level: 200 }, { character_name: "나", character_level: 200 }] }] }), "가");
  assert.equal(mainCharacter({}), "");
  assert.equal(mainCharacter({ account_list: [{ character_list: [{ character_level: 300 }] }] }), "");
});

test("saved keys: shown by character name or place, never by the key", () => {
  assert.equal(keyLabel({ ...mine, name: "내캐릭터" }, 0), "내캐릭터");
  assert.equal(keyLabel(friend, 1), "저장된 키 2");
  assert.ok(!keyLabel(friend, 1).includes("key-b"));
});
