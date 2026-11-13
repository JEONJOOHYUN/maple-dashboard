// NEXON's notice lists (Open API: notice · notice-update · notice-event · notice-cashshop) shaped for the home page.
// Pure, so the rules are testable without the API. Fields checked against real responses on 2026-11-13:
// every list has title · url · notice_id · date; events add thumbnail_url · date_event_start · date_event_end;
// cash shop notices add thumbnail_url · date_sale_start · date_sale_end (both empty for items sold for good).
import { nexonUrl } from "../nexon/url.ts";
import { dateLabel, kstDate } from "../sunday/history.ts";

export { nexonUrl };

export type RawNotice = {
  title?: string;
  url?: string;
  notice_id?: number;
  date?: string;
  thumbnail_url?: string;
  date_event_start?: string;
  date_event_end?: string;
  date_sale_start?: string;
  date_sale_end?: string;
};

export type RawNews = { notice: RawNotice[]; update: RawNotice[]; event: RawNotice[]; cashshop: RawNotice[] };

/** One row of a text list. */
export type NewsLine = { id: number; title: string; url: string; date: string };
/** One picture of a carousel: `badge` = "D-5" · "오늘 마감" (nothing when it has no end). */
export type NewsSlide = { id: number; title: string; url: string; img: string; meta: string; badge: string };

export type HomeNews = { events: NewsSlide[]; cashshop: NewsSlide[]; updates: NewsLine[]; notices: NewsLine[] };

/** Rows a text list shows, and pictures a carousel holds. */
const LINES = 5;
const SLIDES = 10;

const DAY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}/;
/** "2026-11-12" of an API time ("2026-11-12T10:00+09:00": already Korea time), or "". */
const day = (text: string | undefined) => (text && DAY.test(text) ? text.slice(0, 10) : "");
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const ddayLabel = (left: number) => (left <= 0 ? "오늘 마감" : `D-${left}`);

/**
 * Whether `now` is inside the window, to the minute: an event that ended at 09:59 this morning is over, and one that
 * starts next week has not begun (Codex review, 2026-11-13: by the date alone both were listed as on). A side with
 * no time, or one that cannot be read, is open.
 */
function within(now: number, start: string | undefined, end: string | undefined): boolean {
  const from = Date.parse(start ?? "");
  const to = Date.parse(end ?? "");
  return !(Number.isFinite(from) && now < from) && !(Number.isFinite(to) && now > to);
}

function lines(list: RawNotice[]): NewsLine[] {
  return list
    .map((n) => ({ id: n.notice_id ?? 0, title: (n.title ?? "").trim(), url: nexonUrl(n.url), date: day(n.date) }))
    .filter((n) => n.id > 0 && n.title && n.url)
    .slice(0, LINES)
    .map((n) => ({ ...n, date: n.date ? dateLabel(n.date, false) : "" }));
}

/**
 * Events on right now, the one that ends soonest first. The Sunday notice is left out: the card above the lists is
 * that notice read in full.
 */
function events(list: RawNotice[], now: number, today: string): NewsSlide[] {
  return list
    .filter((n) => within(now, n.date_event_start, n.date_event_end))
    .map((n) => ({ id: n.notice_id ?? 0, title: (n.title ?? "").trim(), url: nexonUrl(n.url), img: nexonUrl(n.thumbnail_url), end: day(n.date_event_end) }))
    .filter((n) => n.id > 0 && n.title && n.url && n.img && !n.title.includes("썬데이"))
    .sort((a, b) => (a.end || "9999").localeCompare(b.end || "9999"))
    .slice(0, SLIDES)
    .map(({ end, ...n }) => ({ ...n, meta: end ? `~ ${dateLabel(end)}` : "", badge: end ? ddayLabel(daysBetween(today, end)) : "" }));
}

/** "10월 22일 캐시아이템 업데이트 - 부티크 기프트" → "부티크 기프트": the date is in the line under it. */
const CASH_PREFIX = /^[0-9]+월\s*[0-9]+일\s*캐시\s*아이템\s*업데이트\s*-\s*/;

/** The newest cash shop notices; one whose sale has ended or has not begun is left out. */
function cashshop(list: RawNotice[], now: number, today: string): NewsSlide[] {
  return list
    .filter((n) => within(now, n.date_sale_start, n.date_sale_end))
    .map((n) => ({
      id: n.notice_id ?? 0,
      title: (n.title ?? "").trim().replace(CASH_PREFIX, ""),
      url: nexonUrl(n.url),
      img: nexonUrl(n.thumbnail_url),
      date: day(n.date),
      end: day(n.date_sale_end),
    }))
    .filter((n) => n.id > 0 && n.title && n.url && n.img)
    .slice(0, SLIDES)
    .map(({ end, date, ...n }) => ({
      ...n,
      meta: end ? `~ ${dateLabel(end)}` : date ? `${dateLabel(date, false)} 업데이트` : "",
      badge: end ? ddayLabel(daysBetween(today, end)) : "",
    }));
}

export function shapeNews(raw: RawNews, now: Date): HomeNews {
  // The day in Korea, for "D-5" and the dates shown.
  const today = kstDate(now);
  return { events: events(raw.event, now.getTime(), today), cashshop: cashshop(raw.cashshop, now.getTime(), today), updates: lines(raw.update), notices: lines(raw.notice) };
}
