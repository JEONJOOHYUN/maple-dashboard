// Weekly Sunday Maple update (server only): OCR the images of this week's notice → match known benefits.
// The Cron route finds the notice (notice.ts) and saves the reading with store.ts (sunday_weeks).
import benefits from "./data/benefits.json" with { type: "json" };
import history from "./data/history.json" with { type: "json" };
import { IGNORED_TITLES } from "./ignored";
import { knownBenefits, matchNotice, type NoticeMatch, type OcrLine } from "./match";
import type { SundayNotice } from "./notice";
import { readNoticeImage } from "./ocr";

const KNOWN = knownBenefits(
  benefits.map((b) => b.name),
  history.weeks,
);

export type SundayReading = {
  sunday: string;
  notice: Omit<SundayNotice, "images"> | null;
  images: string[];
  /** Everything OCR read, kept with a stored week so a review can see it. */
  lines: OcrLine[];
  ms: number;
} & NoticeMatch;

/** One OCR call per image of the notice (see ocr.ts for the monthly free quota). No notice: an empty reading. */
export async function readSunday(sunday: string, notice: SundayNotice | null): Promise<SundayReading> {
  const started = Date.now();
  if (!notice) {
    return { sunday, notice: null, images: [], lines: [], items: [], review: [], sundays: [], ms: Date.now() - started };
  }
  const lines: OcrLine[] = [];
  for (const url of notice.images) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`notice image ${res.status}: ${url}`);
    lines.push(...(await readNoticeImage(await res.arrayBuffer())));
  }
  const match = matchNotice(lines, sunday, KNOWN, IGNORED_TITLES);
  const { images, ...rest } = notice;
  return { sunday, notice: rest, images, lines, ...match, ms: Date.now() - started };
}
