import assert from "node:assert/strict";
import { test } from "node:test";
import { SUNDAYS } from "./history.ts";
import { mergeStored, planSave, sameNoticeWaiting, writeOnce, type StoredStatus } from "./stored.ts";

const notice = { id: 1410 };
const item = { name: "콤보킬 경험치 획득량 +300%" };

test("a clean reading is published, one with review notes or no items waits for review", () => {
  assert.deepEqual(planSave({ notice, items: [item], review: [] }, null, false), { action: "write", status: "auto" });
  assert.deepEqual(planSave({ notice, items: [item], review: [{}] }, null, false), { action: "write", status: "review" });
  assert.deepEqual(planSave({ notice, items: [], review: [] }, null, false), { action: "write", status: "review" });
});

test("nothing is written without a notice, for a week already in the history, or over a published week", () => {
  assert.deepEqual(planSave({ notice: null, items: [], review: [] }, null, false), { action: "skip", reason: "no-notice" });
  assert.deepEqual(planSave({ notice, items: [item], review: [] }, null, true), { action: "skip", reason: "in-history" });
  assert.deepEqual(planSave({ notice, items: [item], review: [] }, "auto", false), { action: "skip", reason: "already-published" });
  assert.deepEqual(planSave({ notice, items: [item], review: [{}] }, "confirmed", false), { action: "skip", reason: "already-published" });
});

test("a week waiting for review can be replaced by a later, clean reading", () => {
  assert.deepEqual(planSave({ notice, items: [item], review: [] }, "review", false), { action: "write", status: "auto" });
});

test("stored weeks join after the history; the history wins on a shared date", () => {
  const last = SUNDAYS.at(-1)!;
  const merged = mergeStored(SUNDAYS, [
    { sunday: last.date, notice_id: 1, special: false, items: [item] },
    { sunday: "2099-01-04", notice_id: 1410, special: true, items: [item] },
  ]);
  assert.equal(merged.length, SUNDAYS.length + 1);
  assert.equal(merged.find((w) => w.date === last.date), last);
  const added = merged.at(-1)!;
  assert.equal(added.date, "2099-01-04");
  assert.equal(added.special, true);
  assert.deepEqual(added.notice, [1410]);
  assert.ok(added.bundles.size > 0);
  assert.equal(mergeStored(SUNDAYS, []), SUNDAYS);
});

test("a week waiting for review is not read again while the notice and its images are the same", () => {
  const images = ["https://lwi.nexon.com/a.png", "https://lwi.nexon.com/b.png"];
  const row = { status: "review" as const, notice_id: 1410, images };
  assert.equal(sameNoticeWaiting(row, { id: 1410, images: [...images] }), true);
  assert.equal(sameNoticeWaiting(row, { id: 1411, images }), false); // another notice
  assert.equal(sameNoticeWaiting(row, { id: 1410, images: [images[0]] }), false); // an image was removed
  assert.equal(sameNoticeWaiting(row, { id: 1410, images: [images[0], "https://lwi.nexon.com/c.png"] }), false);
  assert.equal(sameNoticeWaiting(null, { id: 1410, images }), false); // nothing stored yet
  assert.equal(sameNoticeWaiting({ ...row, images: null }, { id: 1410, images }), false);
});

// A stand-in for the sunday_weeks row of one Sunday: insert fails when the row exists, the update is conditional.
function fakeTable(initial: StoredStatus | null = null) {
  const table = { status: initial };
  const writer = (status: "auto" | "review") => ({
    async insert() {
      if (table.status !== null) return "exists" as const;
      table.status = status;
      return "ok" as const;
    },
    async replaceIfReview() {
      if (table.status !== "review") return false;
      table.status = status;
      return true;
    },
  });
  return { table, writer };
}

test("two overlapping runs: a late review reading never replaces the week another run just published", async () => {
  const { table, writer } = fakeTable();
  // Both runs saw "no row" before writing; the clean reading lands first.
  assert.deepEqual(await writeOnce(writer("auto"), "auto"), { action: "write", status: "auto" });
  assert.deepEqual(await writeOnce(writer("review"), "review"), { action: "skip", reason: "already-published" });
  assert.equal(table.status, "auto");
});

test("a week confirmed by a person between the read and the write is kept", async () => {
  const { table, writer } = fakeTable("confirmed");
  assert.deepEqual(await writeOnce(writer("auto"), "auto"), { action: "skip", reason: "already-published" });
  assert.equal(table.status, "confirmed");
});

test("a week still waiting for review is replaced by the new reading", async () => {
  const { table, writer } = fakeTable("review");
  assert.deepEqual(await writeOnce(writer("auto"), "auto"), { action: "write", status: "auto" });
  assert.equal(table.status, "auto");
});
