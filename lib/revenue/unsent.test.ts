import { test } from "node:test";
import assert from "node:assert/strict";
import { clearOld, clearSent, keepUnsent, leftUnsent, type UnsentStore } from "./unsent.ts";

/** localStorage as far as these functions use it. `full` = writing fails (no room left). */
function storage(): UnsentStore & { keys(): string[]; full: boolean } {
  const map = new Map<string, string>();
  return {
    full: false,
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem(k, v) {
      if (this.full) throw new Error("QuotaExceededError");
      map.set(k, v);
    },
    removeItem: (k) => void map.delete(k),
    keys: () => [...map.keys()],
  };
}
const A = "a".repeat(32);
const NOW = 1_800_000_000_000;
const DAY = 24 * 3_600_000;

test("a page keeps one entry, under a new key each time, and clears only its own", () => {
  const s = storage();
  let tab1 = keepUnsent(s, "me", "tab1", "", { fee: 5 }, NOW);
  const tab2 = keepUnsent(s, "me", "tab2", "", { material: false }, NOW + 1);
  const first = tab1;
  tab1 = keepUnsent(s, "me", "tab1", tab1, { fee: 5, picked: [A] }, NOW + 2);
  assert.notEqual(tab1, first);
  assert.deepEqual(s.keys().sort(), [tab1, tab2].sort());
  // Tab 1's save landed.
  assert.equal(keepUnsent(s, "me", "tab1", tab1, {}, NOW + 3), "");
  assert.deepEqual(s.keys(), [tab2]);
  assert.deepEqual(leftUnsent(s, "me", "tab3", NOW + 4)?.patch, { material: false });
  // Tab 2 does not read its own entry back as something left by another page.
  assert.equal(leftUnsent(s, "me", "tab2", NOW + 4), null);
});

test("another member's unsent changes are neither read, overwritten nor cleared", () => {
  const s = storage();
  keepUnsent(s, "memberA", "p1", "", { fee: 5 }, NOW);
  keepUnsent(s, "memberB", "p2", "", { fee: 3, picked: [A] }, NOW + 1);
  const left = leftUnsent(s, "memberB", "p3", NOW + 2);
  assert.deepEqual(left?.patch, { fee: 3, picked: [A] });
  clearSent(s, left!.keys);
  assert.deepEqual(leftUnsent(s, "memberA", "p4", NOW + 4)?.patch, { fee: 5 });
});

test("the next visit sends everything its member left, the later change winning, and clears it once it is saved", () => {
  const s = storage();
  keepUnsent(s, "me", "old1", "", { fee: 5, party: { [`${A}|카링`]: 2 } }, NOW);
  keepUnsent(s, "me", "old2", "", { fee: 3 }, NOW + 10);
  const left = leftUnsent(s, "me", "new", NOW + 20)!;
  assert.deepEqual(left.patch, { fee: 3, party: { [`${A}|카링`]: 2 } });
  // Reading clears nothing: until the server has saved it, the entries are still there for a later visit.
  assert.equal(s.keys().length, 2);
  assert.deepEqual(leftUnsent(s, "me", "another", NOW + 21)?.patch, left.patch);
  clearSent(s, left.keys);
  assert.equal(s.keys().length, 0);
});

test("what another tab writes after it was read is never cleared, whenever the write comes", () => {
  const s = storage();
  const tabA = keepUnsent(s, "me", "tabA", "", { fee: 5 }, NOW);
  const left = leftUnsent(s, "me", "tabB", NOW + 1)!;
  // Tab A changes more, and a third tab leaves something, before tab B's save comes back.
  keepUnsent(s, "me", "tabA", tabA, { fee: 5, material: false }, NOW + 2);
  keepUnsent(s, "me", "tabC", "", { picked: [A] }, NOW + 3);
  clearSent(s, left.keys);
  assert.deepEqual(leftUnsent(s, "me", "tabB", NOW + 4)?.patch, { fee: 5, material: false, picked: [A] });

  // The write lands in the middle of the clearing itself (between two storage calls): it is under a key that was
  // never read, so it stays. An entry is never rewritten, so there is no check for a write to slip past.
  const t = storage();
  let other = keepUnsent(t, "me", "tabA", "", { fee: 5 }, NOW);
  const read = leftUnsent(t, "me", "tabB", NOW + 1)!;
  const remove = t.removeItem;
  t.removeItem = (k) => {
    if (k === other) other = keepUnsent({ ...t, removeItem: remove }, "me", "tabA", other, { fee: 3 }, NOW + 2);
    remove(k);
  };
  clearSent(t, read.keys);
  t.removeItem = remove;
  assert.deepEqual(leftUnsent(t, "me", "tabB", NOW + 3)?.patch, { fee: 3 });

  // Nothing was read at all (an empty storage), then another tab writes: nothing of it is cleared.
  const u = storage();
  const none = leftUnsent(u, "me", "tabB", NOW);
  keepUnsent(u, "me", "tabA", "", { fee: 5 }, NOW + 1);
  clearSent(u, none?.keys ?? []);
  assert.deepEqual(leftUnsent(u, "me", "tabB", NOW + 2)?.patch, { fee: 5 });
});

test("a key is never used twice: a late clearing cannot take what the page wrote after its save landed", () => {
  const s = storage();
  let tabA = keepUnsent(s, "me", "tabA", "", { fee: 5 }, NOW);
  // Tab B reads it and sends it; meanwhile tab A’s own save lands (nothing left), and then tab A changes again.
  const read = leftUnsent(s, "me", "tabB", NOW + 1)!;
  tabA = keepUnsent(s, "me", "tabA", tabA, {}, NOW + 2);
  assert.equal(tabA, "");
  tabA = keepUnsent(s, "me", "tabA", tabA, { material: false }, NOW + 3);
  assert.ok(!read.keys.includes(tabA));
  clearSent(s, read.keys);
  assert.deepEqual(leftUnsent(s, "me", "tabB", NOW + 4)?.patch, { material: false });
  // The same after a day: the old entry is dropped, what the page wrote since is not.
  const old = keepUnsent(s, "me", "tabC", "", { fee: 3 }, NOW);
  const fresh = keepUnsent(s, "me", "tabC", old, { fee: 5 }, NOW + DAY);
  clearOld(s, NOW + DAY + 1);
  assert.ok(s.keys().includes(fresh));
});

test("no room to write: the page's previous entry stays, and what was left by others is not lost", () => {
  const s = storage();
  keepUnsent(s, "me", "old", "", { fee: 5 }, NOW);
  const mine = keepUnsent(s, "me", "new", "", { material: false }, NOW + 1);
  const left = leftUnsent(s, "me", "new", NOW + 1)!;
  s.full = true;
  assert.throws(() => keepUnsent(s, "me", "new", mine, { ...left.patch, material: false, picked: [A] }, NOW + 2));
  s.full = false;
  // The page closes before its save lands: the next visit still finds both.
  assert.deepEqual(leftUnsent(s, "me", "next", NOW + 3)?.patch, { fee: 5, material: false });
});

test("after a day a change is not sent any more, and what is not a patch is ignored", () => {
  const s = storage();
  keepUnsent(s, "me", "old", "", { fee: 5 }, NOW);
  keepUnsent(s, "other", "old", "", { fee: 5 }, NOW);
  const fresh = keepUnsent(s, "me", "fresh", "", { fee: 3 }, NOW + DAY);
  s.setItem("revenue:unsent:me:broken:1", "{not json");
  s.setItem("revenue:unsent:me:junk:1", JSON.stringify({ at: NOW + DAY, patch: { fee: 99, nonsense: true } }));
  s.setItem("revenue:picked", "[]");
  assert.deepEqual(leftUnsent(s, "me", "new", NOW + DAY + 1)?.patch, { fee: 3 });
  clearOld(s, NOW + DAY + 1);
  // The old entries are gone, anyone's; the fresh ones and everything else in the storage stay.
  assert.deepEqual(s.keys().sort(), ["revenue:picked", fresh, "revenue:unsent:me:junk:1"].sort());
});
