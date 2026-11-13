import assert from "node:assert/strict";
import { test } from "node:test";
import { pageRange, pageSlots } from "./pager.ts";

test("pageSlots: every page when there are few, seven slots with gaps when there are many", () => {
  assert.deepEqual(pageSlots(1, 1), [1]);
  assert.deepEqual(pageSlots(3, 7), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(pageSlots(1, 20), [1, 2, 3, 4, 5, 0, 20]);
  assert.deepEqual(pageSlots(4, 20), [1, 2, 3, 4, 5, 0, 20]);
  assert.deepEqual(pageSlots(5, 20), [1, 0, 4, 5, 6, 0, 20]);
  assert.deepEqual(pageSlots(16, 20), [1, 0, 15, 16, 17, 0, 20]);
  assert.deepEqual(pageSlots(17, 20), [1, 0, 16, 17, 18, 19, 20]);
  assert.deepEqual(pageSlots(20, 20), [1, 0, 16, 17, 18, 19, 20]);
  assert.deepEqual(pageSlots(4, 8), [1, 2, 3, 4, 5, 0, 8]);
  assert.deepEqual(pageSlots(5, 8), [1, 0, 4, 5, 6, 7, 8]);
});

test("pageSlots: the current page is always offered, pages are in order and never repeated", () => {
  for (let pages = 1; pages <= 40; pages++)
    for (let page = 1; page <= pages; page++) {
      const slots = pageSlots(page, pages);
      const shown = slots.filter((p) => p > 0);
      assert.ok(shown.includes(page), `${page}/${pages}`);
      assert.ok(slots.length <= 7, `${page}/${pages}`);
      assert.deepEqual(shown, [...new Set(shown)].sort((a, b) => a - b), `${page}/${pages}`);
      assert.equal(shown[0], 1);
      assert.equal(shown.at(-1), pages);
      // A gap always stands for at least two pages.
      slots.forEach((p, i) => p === 0 && assert.ok(slots[i + 1] - slots[i - 1] > 2, `${page}/${pages}`));
    }
});

test("pageRange: slices by page and keeps the page inside the list", () => {
  assert.deepEqual(pageRange(1, 30, 12), { page: 1, pages: 3, from: 0, to: 12 });
  assert.deepEqual(pageRange(3, 30, 12), { page: 3, pages: 3, from: 24, to: 30 });
  assert.deepEqual(pageRange(9, 30, 12), { page: 3, pages: 3, from: 24, to: 30 });
  assert.deepEqual(pageRange(0, 30, 12), { page: 1, pages: 3, from: 0, to: 12 });
  assert.deepEqual(pageRange(2, 0, 12), { page: 1, pages: 1, from: 0, to: 0 });
  assert.deepEqual(pageRange(1, 12, 12), { page: 1, pages: 1, from: 0, to: 12 });
});
