// NEXON's notices for the home page: four lists of the Open API, read with our own key on the server.
// The lists change a few times a day at most, so they are cached for half an hour: four calls each time, about 190
// a day, well inside a development-stage key's 1,000. A failed read never breaks the page: it shows without news.
import "server-only";
import { unstable_cache } from "next/cache";
import { nexonGet } from "@/lib/nexon/api";
import { shapeNews, type HomeNews, type RawNews, type RawNotice } from "./news-parse";

/** Only what the page uses is kept in the cache. */
const trim = (list: RawNotice[] | undefined): RawNotice[] =>
  (Array.isArray(list) ? list : []).slice(0, 20).map((n) => ({
    title: n.title,
    url: n.url,
    notice_id: n.notice_id,
    date: n.date,
    thumbnail_url: n.thumbnail_url,
    date_event_start: n.date_event_start,
    date_event_end: n.date_event_end,
    date_sale_start: n.date_sale_start,
    date_sale_end: n.date_sale_end,
  }));

// The lists are cached as they came: what is "still on" depends on the day, which is worked out per request.
// A failed read throws, and a thrown error is not cached.
const loadRaw = unstable_cache(
  async (): Promise<RawNews> => {
    const notice = await nexonGet<{ notice: RawNotice[] }>("notice", {});
    const update = await nexonGet<{ update_notice: RawNotice[] }>("notice-update", {});
    const event = await nexonGet<{ event_notice: RawNotice[] }>("notice-event", {});
    const cashshop = await nexonGet<{ cashshop_notice: RawNotice[] }>("notice-cashshop", {});
    return { notice: trim(notice.notice), update: trim(update.update_notice), event: trim(event.event_notice), cashshop: trim(cashshop.cashshop_notice) };
  },
  // "-v2": the rows carry the start times (rows cached before them would come back without).
  ["home-news-v2"],
  { revalidate: 1800 },
);

export async function loadHomeNews(now: Date): Promise<HomeNews | null> {
  try {
    return shapeNews(await loadRaw(), now);
  } catch (e) {
    console.error("home news read failed", e);
    return null;
  }
}
