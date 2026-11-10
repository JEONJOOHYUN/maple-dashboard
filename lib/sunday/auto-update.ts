// Weekly Sunday Maple update (server only): find this week's notice → OCR its images → match known benefits.
// Saving to Supabase and the review screen come in the next stage; for now the Cron route returns the result.
import benefits from "./data/benefits.json" with { type: "json" };
import history from "./data/history.json" with { type: "json" };
import { IGNORED_TITLES } from "./ignored";
import { knownBenefits, matchNotice, type NoticeMatch, type OcrLine } from "./match";
import { findSundayNotice, type SundayNotice } from "./notice";
import { readNoticeImage } from "./ocr";

const KNOWN = knownBenefits(
  benefits.map((b) => b.name),
  history.weeks,
);

export type SundayReading = {
  sunday: string;
  notice: Omit<SundayNotice, "images"> | null;
  images: string[];
  ms: number;
} & NoticeMatch;

export async function readSunday(sunday: string): Promise<SundayReading> {
  const started = Date.now();
  const notice = await findSundayNotice(sunday);
  if (!notice) {
    return { sunday, notice: null, images: [], items: [], review: [], sundays: [], ms: Date.now() - started };
  }
  const lines: OcrLine[] = [];
  for (const url of notice.images) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`notice image ${res.status}: ${url}`);
    lines.push(...(await readNoticeImage(await res.arrayBuffer())));
  }
  const match = matchNotice(lines, sunday, KNOWN, IGNORED_TITLES);
  const { images, ...rest } = notice;
  return { sunday, notice: rest, images, ...match, ms: Date.now() - started };
}
