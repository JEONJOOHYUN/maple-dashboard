import assert from "node:assert/strict";
import { test } from "node:test";
import { linesFromWords } from "./ocr-lines.ts";

const word = (text: string, x: number, top: number, height: number) => ({ text, x, top, bottom: top + height });

test("words on one visual row join left to right, whatever order OCR returned them in", () => {
  const lines = linesFromWords([word("+300%", 300, 102, 36), word("콤보킬", 10, 100, 36), word("경험치", 120, 101, 35), word("획득량", 210, 100, 36)]);
  assert.deepEqual(lines, [{ t: "콤보킬 경험치 획득량 +300%", h: 36 }]);
});

test("rows come out top to bottom, each with the height of its tallest word", () => {
  const lines = linesFromWords([word("· 기본 획득량에", 10, 150, 20), word("룬", 10, 100, 34), word("경험치", 60, 98, 38)]);
  assert.deepEqual(lines, [
    { t: "룬 경험치", h: 38 },
    { t: "· 기본 획득량에", h: 20 },
  ]);
});

test("no words give no lines", () => {
  assert.deepEqual(linesFromWords([]), []);
});
