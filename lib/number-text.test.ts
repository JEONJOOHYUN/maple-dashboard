import { test } from "node:test";
import assert from "node:assert/strict";
import { caretAfter, cleanNumberText, forwardDeleteText, groupDigits, keptBefore } from "./number-text.ts";

test("groupDigits: commas every three digits of the whole part, any size", () => {
  assert.equal(groupDigits(""), "");
  assert.equal(groupDigits("7"), "7");
  assert.equal(groupDigits("999"), "999");
  assert.equal(groupDigits("1000"), "1,000");
  assert.equal(groupDigits("1000000"), "1,000,000");
  assert.equal(groupDigits("123456789012"), "123,456,789,012");
  assert.equal(groupDigits("1234.5678"), "1,234.5678");
  assert.equal(groupDigits("1."), "1.");
  assert.equal(groupDigits(".5"), ".5");
  // Already grouped text is left alone.
  assert.equal(groupDigits("1,000"), "1,000");
});

test("cleanNumberText: commas and other characters drop out, one dot, 12 characters", () => {
  assert.equal(cleanNumberText("1,000,000"), "1000000");
  assert.equal(cleanNumberText("12a3"), "123");
  assert.equal(cleanNumberText("1.5"), "15");
  assert.equal(cleanNumberText("1.5", true), "1.5");
  assert.equal(cleanNumberText("1.2.3", true), "1.23");
  assert.equal(cleanNumberText("1,234.5", true), "1234.5");
  assert.equal(cleanNumberText("1234567890123"), "123456789012");
});

test("caret: stays after the same digit when commas appear or go", () => {
  // Typing 5 at the end of "1,234": the field holds "1,2345" with the caret at 6 → shown "12,345", caret at the end.
  const typed = "1,2345";
  const kept = keptBefore(typed, 6);
  const shown = groupDigits(cleanNumberText(typed));
  assert.equal(shown, "12,345");
  assert.equal(caretAfter(shown, kept), 6);
  // Typing 9 after the first digit of "1,000": "19,000" caret 2 → "19,000", caret 2 (before the comma).
  assert.equal(caretAfter(groupDigits(cleanNumberText("19,000")), keptBefore("19,000", 2)), 2);
  // Deleting the second digit of "12,345" (caret was 2): "1,345" caret 1 → shown "1,345", caret 1.
  assert.equal(caretAfter(groupDigits(cleanNumberText("1,345")), keptBefore("1,345", 1)), 1);
  // Backspace on a comma ("1,000" caret 2 → "1000" caret 1): nothing to drop, caret before the comma.
  assert.equal(caretAfter(groupDigits(cleanNumberText("1000")), keptBefore("1000", 1)), 1);
  // Decimals: the dot counts as a kept character.
  assert.equal(caretAfter(groupDigits(cleanNumberText("1234.5", true)), keptBefore("1234.5", 5, true), true), 6);
  assert.equal(caretAfter("1,000", 0), 0);
});

test("forwardDeleteText: Delete before a comma takes the digit after it, other deletes are left alone", () => {
  // "1|,234" Delete → the browser leaves "1234" (caret 1) → "134"
  assert.equal(forwardDeleteText("1234", 1, "1234"), "134");
  // "12|,345,678" Delete → "12345,678" (caret 2) → the 3 goes: 1,245,678
  assert.equal(cleanNumberText(forwardDeleteText("12345,678", 2, "12345678")), "1245678");
  // a digit was deleted: nothing more
  assert.equal(forwardDeleteText("1,34", 1, "1234"), "1,34");
  // decimals: Delete on the comma before "234.5"
  assert.equal(forwardDeleteText("1234.5", 1, "1234.5", true), "134.5");
  // nothing after the caret to take
  assert.equal(forwardDeleteText("1", 1, "1"), "1");
});
