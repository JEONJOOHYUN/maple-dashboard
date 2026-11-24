import { test } from "node:test";
import assert from "node:assert/strict";
import { markKey, partyFor, withParty } from "./calc.ts";
import { MAX_ENTRIES, applyPatch, cleanPatch, isEmptyPatch, joinPatches, noSettings, patchOf, rowOf, settingsOf, tooBig, type Settings } from "./settings.ts";

const A = "a".repeat(32);
const B = "b".repeat(32);
const base = (over: Partial<Settings> = {}): Settings => ({ ...noSettings(), ...over });

test("only what changed travels, and the other device's changes stay", () => {
  const start = base({ party: withParty({}, A, "카링", "하드", 3), prices: { rr4: "30" } });
  // Device 1 sets another boss; device 2 (same start) changes a price.
  const one = patchOf(start, { ...start, party: withParty(start.party, A, "림보", "노멀", 2) });
  const two = patchOf(start, { ...start, prices: { ...start.prices, ct4: "21.5" } });
  assert.deepEqual(Object.keys(one), ["party"]);
  assert.deepEqual(Object.keys(two), ["prices"]);
  const server = applyPatch(applyPatch(start, cleanPatch(one)!), cleanPatch(two)!);
  assert.equal(partyFor(server.party, A, "카링", "하드"), 3);
  assert.equal(partyFor(server.party, A, "림보", "노멀"), 2);
  assert.deepEqual(server.prices, { rr4: "30", ct4: "21.5" });
  assert.ok(isEmptyPatch(patchOf(start, start)));
});

test("a removed entry is removed on the server too", () => {
  const start = base({ prices: { rr4: "30", ct4: "20" }, got: { week: "2026-11-19", marks: { [markKey(A, "카링|하드", "ring")]: "rr4" } } });
  const next = { ...start, prices: { ct4: "20" }, got: { week: "2026-11-19", marks: {} } };
  const after = applyPatch(start, cleanPatch(patchOf(start, next))!);
  assert.deepEqual(after.prices, { ct4: "20" });
  assert.deepEqual(after.got, { week: "2026-11-19", marks: {} });
  // A cleared price field is the default again.
  assert.deepEqual(applyPatch(start, cleanPatch({ prices: { rr4: "  " } })!).prices, { ct4: "20" });
});

test("checked rewards: a new week starts empty, an old week never comes back", () => {
  const k1 = markKey(A, "카링|하드", "ring");
  const k2 = markKey(B, "스우|하드", "pitch");
  const kept = base({ got: { week: "2026-11-19", marks: { [k1]: "rr4" } } });
  const sameWeek = applyPatch(kept, { marks: { week: "2026-11-19", set: { [k2]: true } } });
  assert.deepEqual(sameWeek.got.marks, { [k1]: "rr4", [k2]: true });
  const newWeek = applyPatch(kept, { marks: { week: "2026-11-26", set: { [k2]: true } } });
  assert.deepEqual(newWeek.got, { week: "2026-11-26", marks: { [k2]: true } });
  // A tab open since last week sends a change of that week: dropped.
  assert.deepEqual(applyPatch(newWeek, { marks: { week: "2026-11-19", set: { [k1]: null } } }).got, newWeek.got);
  // The browser's first change of a new week carries the whole (new) week.
  const first = patchOf(kept, { ...kept, got: { week: "2026-11-26", marks: { [k2]: true } } });
  assert.deepEqual(first.marks, { week: "2026-11-26", set: { [k2]: true } });
});

test("what a browser sends is checked entry by entry", () => {
  assert.equal(cleanPatch(null), null);
  assert.equal(cleanPatch([]), null);
  const cleaned = cleanPatch({
    party: { [`${A}|카링|하드`]: 3, [`${A}|카링`]: 3, "short|카링": 2, [`${A}|림보|노멀`]: 9, [`${A}|스우|하드|extra`]: 2, [`${B}|스우`]: null },
    prices: { rr4: "1,234.5", nope: "3", ct4: "<b>", lifeStone: "" },
    marks: { week: "2026-11-19", set: { [markKey(A, "카링|하드", "ring")]: "rr4", [markKey(A, "카링|하드", "glow")]: "notAnItem", [`${A}|카링|하드|hat`]: true } },
    fee: 4,
    material: "yes",
    picked: [A, "zzz", A, B],
    autoPicked: ["m12", "bad id", "m12", 7],
    extra: 1,
  })!;
  assert.deepEqual(cleaned.party, { [`${A}|카링|하드`]: 3, [`${A}|카링`]: 3, [`${B}|스우`]: null });
  assert.deepEqual(cleaned.prices, { rr4: "1,234.5", lifeStone: null });
  assert.deepEqual(cleaned.marks, { week: "2026-11-19", set: { [markKey(A, "카링|하드", "ring")]: "rr4" } });
  assert.equal(cleaned.fee, undefined);
  assert.equal(cleaned.material, undefined);
  assert.deepEqual(cleaned.picked, [A, B]);
  assert.deepEqual(cleaned.autoPicked, ["m12"]);
  assert.deepEqual(Object.keys(cleaned).sort(), ["autoPicked", "marks", "party", "picked", "prices"]);
  assert.deepEqual(cleanPatch({ marks: { week: "last week", set: {} } }), {});
  assert.deepEqual(cleanPatch({ fee: 5, material: false }), { fee: 5, material: false });
});

test("changes waiting to be sent go as one, the later winning", () => {
  const a = { party: { x: 1, y: 2 }, fee: 3, marks: { week: "2026-11-19", set: { m: true as const } } };
  const b = { party: { y: null, z: 4 }, picked: [A], marks: { week: "2026-11-19", set: { n: "rr4" } } };
  assert.deepEqual(joinPatches(a, b), { party: { x: 1, y: null, z: 4 }, fee: 3, picked: [A], marks: { week: "2026-11-19", set: { m: true, n: "rr4" } } });
  assert.deepEqual(joinPatches(a, { marks: { week: "2026-11-26", set: {} } }).marks, { week: "2026-11-26", set: {} });
});

test("a row comes back as the settings it was saved from, and a row that grew too big is refused", () => {
  const s = base({ party: withParty({}, A, "카링", "하드", 3), prices: { rr4: "30" }, got: { week: "2026-11-19", marks: { [markKey(A, "카링|하드", "ring")]: "rr4" } }, fee: 5, material: false, picked: [A, B], autoPicked: ["m1"] });
  assert.deepEqual(settingsOf(rowOf(s)), s);
  // An empty or damaged row reads as the defaults.
  assert.deepEqual(settingsOf({ party: null, prices: "x", got_week: "", got: {}, fee: 99, material: null, picked: null, auto_picked: null }), noSettings());
  const many: Record<string, number> = {};
  for (let i = 0; i <= MAX_ENTRIES; i++) many[`${A}|보스${i}`] = 1;
  assert.equal(tooBig(base({ party: many })), true);
  assert.equal(tooBig(s), false);
});
