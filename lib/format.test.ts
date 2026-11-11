import assert from "node:assert/strict";
import { test } from "node:test";
import { formatKoreanMeso, koreanUnits } from "./format.ts";

test("korean units change every 10,000 (만 · 억 · 조 · 경)", () => {
  assert.equal(koreanUnits(0), "0");
  assert.equal(koreanUnits(9_999), "9,999");
  assert.equal(koreanUnits(10_000), "1만");
  assert.equal(koreanUnits(38_136), "3만 8,136");
  assert.equal(koreanUnits(750_000), "75만");
  // The two largest units stay, the rest is rounded.
  assert.equal(koreanUnits(123_456_789), "1억 2,346만");
  assert.equal(koreanUnits(506_200_000_000), "5,062억");
  assert.equal(koreanUnits(1_013_040_000_000), "1조 130억");
  assert.equal(koreanUnits(21_510_700_000_000), "21조 5,107억");
  assert.equal(koreanUnits(3_124_138_300_000_000), "3,124조 1,383억");
  assert.equal(koreanUnits(12_345_678_900_000_000), "1경 2,346조");
  // Rounding up carries into the next unit instead of showing 10,000 of the lower one.
  assert.equal(koreanUnits(99_999_999), "9,999만 9,999");
  assert.equal(koreanUnits(999_999_995_000), "1조");
  assert.equal(koreanUnits(999_999_999_999), "1조");
  assert.equal(koreanUnits(-35_000_000_000_000), "-35조");
  assert.equal(koreanUnits(Infinity), "—");
});

test("every unit kept when asked", () => {
  assert.equal(koreanUnits(123_456_789, Infinity), "1억 2,345만 6,789");
  assert.equal(koreanUnits(1_234_547_506_789, Infinity), "1조 2,345억 4,750만 6,789");
  assert.equal(formatKoreanMeso(475_000_000, { spaced: true }), "4억 7,500만 메소");
  assert.equal(formatKoreanMeso(1_234_547_506_789, { spaced: true }), "1조 2,345억 4,750만 6,789 메소");
  assert.equal(formatKoreanMeso(0), "0 메소");
});
