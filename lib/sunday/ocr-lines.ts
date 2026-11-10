// Rebuilds text lines from OCR word boxes: words whose vertical middles overlap form one line, left to right.
// CLOVA's own lineBreak flag marks paragraphs, not visual rows, and splits benefit titles (75-week check
// 2026-11-10: 24 weeks saved automatically with the flag, 71 with the boxes).
import type { OcrLine } from "./match.ts";

export type OcrWord = { text: string; x: number; top: number; bottom: number };

export function linesFromWords(words: OcrWord[]): OcrLine[] {
  const sorted = [...words].sort((a, b) => (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2);
  const rows: { top: number; bottom: number; words: OcrWord[] }[] = [];
  for (const w of sorted) {
    const mid = (w.top + w.bottom) / 2;
    const row = rows.at(-1);
    if (row && mid > row.top && mid < row.bottom) {
      row.words.push(w);
      row.top = Math.min(row.top, w.top);
      row.bottom = Math.max(row.bottom, w.bottom);
    } else {
      rows.push({ top: w.top, bottom: w.bottom, words: [w] });
    }
  }
  return rows.map((row) => ({
    t: row.words
      .sort((a, b) => a.x - b.x)
      .map((w) => w.text)
      .join(" "),
    h: Math.round(Math.max(...row.words.map((w) => w.bottom - w.top))),
  }));
}
