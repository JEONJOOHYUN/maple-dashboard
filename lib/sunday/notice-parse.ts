// Pure helpers for lib/sunday/notice.ts (kept apart so tests run without the NEXON client).

export type EventNotice = {
  title: string;
  url: string;
  notice_id: number;
  date: string;
  date_event_start: string; // e.g. "2026-11-15T00:00+09:00" (KST)
  date_event_end: string;
};

const SUNDAY_TITLE = /[썬선]데이\s*메이플/;

/** The Sunday Maple notice whose event period (KST dates) includes `sunday`; the newest one if several. */
export function pickSundayNotice(list: EventNotice[], sunday: string): EventNotice | null {
  const hits = list.filter(
    (n) => SUNDAY_TITLE.test(n.title) && n.date_event_start.slice(0, 10) <= sunday && sunday <= n.date_event_end.slice(0, 10),
  );
  return hits.sort((a, b) => b.notice_id - a.notice_id)[0] ?? null;
}

const IMAGE_HOST = "https://lwi.nexon.com/";

/**
 * Notice body images in page order. Skips animated GIF decorations and the editor's leftover copies
 * (s3:// links, /test/ and /pre-lwis3/ paths seen in 2026 notices).
 */
export function noticeImages(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    const src = m[1].replace(/^http:\/\//, "https://");
    if (!src.startsWith(IMAGE_HOST) || /\.gif(\?|$)/i.test(src) || /\/test\/|\/pre-lwis3\/|top_motion/.test(src)) continue;
    if (!out.includes(src)) out.push(src);
  }
  return out;
}
