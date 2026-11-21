import Link from "next/link";
import { connection } from "next/server";
import { ExternalLink, Sun } from "lucide-react";
import { NewsList } from "@/components/home/news-list";
import { ThumbCarousel } from "@/components/home/thumb-carousel";
import { SundayHomeCard } from "@/components/sunday/home-card";
import { Badge } from "@/components/ui/badge";
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
  const recorded = sunday.thisWeek.recorded;
  const topThemes = [...sunday.prediction.themes].sort((a, b) => b.p - a.p).slice(0, 2);
  return (
    <div className="flex flex-col gap-2">
      <h1 className="sr-only">메이플 대시보드</h1>

      {recorded ? (
        <SundayHomeCard week={sunday.thisWeek} recorded={recorded} bigDays={sunday.prediction.bigDays} />
      ) : (
        <Link
          href="/sunday"
          className="flex flex-wrap items-center gap-3.5 tile px-[18px] py-3.5 transition-shadow outline-none hover:shadow-tile-hover focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
            <Sun className="size-[18px]" aria-hidden="true" />
          </span>
          <span className="flex min-w-[180px] flex-1 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">썬데이 메이플 · {sunday.prediction.label} 예측</span>
            <b className="flex flex-wrap gap-x-1.5 text-sm break-keep">
              <span>{sunday.prediction.headline ?? "뚜렷한 테마 없음"}</span>
              {topThemes.map((t) => (
                <span key={t.id} className="whitespace-nowrap">
                  · {t.label} {Math.round(t.p * 100)}%
                </span>
              ))}
            </b>
            {sunday.prediction.bigDays.length > 0 && (
              <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                {sunday.prediction.bigDays.map((d) => (
                  <span key={d.id} className="whitespace-nowrap">
                    {d.label.replace(" 타임", "")} {d.overdue ? "나올 때 지남" : d.when}
                  </span>
                ))}
              </span>
            )}
          </span>
          <span className="text-xs font-semibold text-primary-text">자세히 →</span>
        </Link>
      )}

      {/* One line until the member features exist (`members` branch): then this is the login button and the week itself. */}
      <section aria-label="이번 주 내 메이플" className="flex flex-wrap items-center gap-x-6 gap-y-3 tile px-[18px] py-4">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold">이번 주 내 메이플</h2>
            <Badge variant="secondary" className="text-muted-foreground">
              준비 중
            </Badge>
          </span>
          <p className="text-[13px] text-muted-foreground">로그인하면 이번 주 수익 · 숙제 · 보스 수익을 한눈에</p>
        </div>
        {/* Where the three numbers will sit once the member features ship: the card keeps this shape then. */}
        <ul aria-hidden="true" className="flex min-w-[240px] flex-1 gap-2">
          {["수익", "숙제", "보스 수익"].map((slot) => (
            <li key={slot} className="h-14 min-w-0 flex-1 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap text-muted-foreground outline-1 -outline-offset-1 outline-border outline-dashed">
              {slot}
            </li>
          ))}
        </ul>
      </section>

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
