import { connection } from "next/server";
import { ExternalLink } from "lucide-react";
import { MyWeek } from "@/components/home/my-week";
import { NewsList } from "@/components/home/news-list";
import { ThumbCarousel } from "@/components/home/thumb-carousel";
import { SundayHomeCard } from "@/components/sunday/home-card";
import { loadHomeNews } from "@/lib/home/news";
import { loadMlScores, loadSeasonPatches, loadSundayWeeks } from "@/lib/sunday/live";
import { getSundayPageData } from "@/lib/sunday/view";

const NEXON_NEWS = "https://maplestory.nexon.com/News";

// Home (user, 2026-11-13): no list of our own tools — they are in the menu — but what a player comes to look at:
// this week's Sunday, their own week, and NEXON's events · cash shop · updates · notices.
// The Sunday card depends on the clock (Monday 00:00 KST rollover, Friday notice) and the events on the day, so the
// page renders per request; the database rows and the notice lists are cached in lib/sunday/live.ts · lib/home/news.ts.
export default async function Home() {
  await connection();
  const now = new Date();
  const [weeks, ml, patches, news] = await Promise.all([loadSundayWeeks(), loadMlScores(), loadSeasonPatches(), loadHomeNews(now)]);
  const sunday = getSundayPageData(now, weeks, ml, patches);
  return (
    <div className="flex flex-col gap-2">
      <h1 className="sr-only">메이플 대시보드</h1>

      <div className="flex flex-wrap gap-2">
        <SundayHomeCard week={sunday.thisWeek} prediction={sunday.prediction} />

        <MyWeek />
      </div>

      {news ? (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <ThumbCarousel title="진행 중 이벤트" more={`${NEXON_NEWS}/Event`} slides={news.events} empty="진행 중인 이벤트 없음" />
          <ThumbCarousel title="캐시샵" more={`${NEXON_NEWS}/CashShop`} slides={news.cashshop} empty="새 캐시샵 소식 없음" />
          <NewsList title="업데이트" more={`${NEXON_NEWS}/Update`} lines={news.updates} />
          <NewsList title="공지사항" more={`${NEXON_NEWS}/Notice`} lines={news.notices} />
        </div>
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-3 tile px-[18px] py-3.5 text-[13px]">
          <span className="text-muted-foreground">넥슨 소식을 불러오지 못함</span>
          <a
            href={`${NEXON_NEWS}/Notice`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-sm font-semibold text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            넥슨 공지 보기
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </section>
      )}
    </div>
  );
}
