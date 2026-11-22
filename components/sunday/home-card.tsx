import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PILL_LINK, PillArrow } from "@/components/home/more-link";
import { NoticeImage } from "@/components/sunday/notice-image";
import { cn } from "@/lib/utils";
import type { SundayPageData } from "@/lib/sunday/view";

const pct = (p: number) => `${Math.round(p * 100)}%`;
/** Benefits listed on the tile; a Sunday with more says how many are left ("자세히" has them all). */
const MAX_ROWS = 4;

/**
 * The Sunday tile of the home page (confirmed design C, user 2026-11-22): how many days are left and what kind of day
 * it is — the recorded notice's title and its benefits, or the predicted theme until the notice is recorded — and the
 * three theme odds of the predicted Sunday as a fan of cards. The windows of the big days and the links are one strip
 * along the bottom, so a Sunday with many benefits does not make the tile much taller (user, 2026-11-22).
 * The whole tile opens /sunday; "공지사항" goes to NEXON's notice, "원본 그림" opens the notice's picture in a window.
 */
export function SundayHomeCard({ week, prediction }: { week: SundayPageData["thisWeek"]; prediction: SundayPageData["prediction"] }) {
  const recorded = week.recorded;
  const dday = week.daysLeft <= 0 ? "오늘" : `D-${week.daysLeft}`;
  const title = recorded ? recorded.title : (prediction.headline ?? "뚜렷한 테마 없음");
  // The benefits themselves once the notice is recorded (user, 2026-11-22): not when the only one is the title again.
  const rows = recorded ? recorded.rows.filter((r) => r.amount || r.name !== recorded.title) : [];
  const shown = rows.slice(0, MAX_ROWS);
  const maxP = Math.max(...prediction.themes.map((t) => t.p));
  // The likeliest theme is the front card in the middle; the other two keep their order on its sides.
  const top = prediction.themes.find((t) => t.p === maxP);
  const sides = prediction.themes.filter((t) => t !== top);
  const fan = top && sides.length === 2 ? [sides[0], top, sides[1]] : prediction.themes;
  return (
    <section
      aria-label="이번 주 썬데이 메이플"
      className="relative flex min-w-0 flex-[7_1_460px] flex-col justify-between gap-5 rounded-[1rem] border border-transparent bg-primary-soft p-4 shadow-tile transition-shadow hover:shadow-tile-hover sm:p-6"
    >
      {/* The whole tile opens /sunday for a pointer; the keyboard and screen readers get the one "자세히" link. */}
      <Link href="/sunday" aria-hidden="true" tabIndex={-1} className="absolute inset-0 rounded-[1rem]" />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-5">
        <div className="flex min-w-0 flex-[1_1_240px] flex-col items-start gap-3.5">
          <span className="text-[13px] font-bold text-primary-text">썬데이 메이플</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <b className="font-num text-[60px] leading-[0.9] whitespace-nowrap text-primary-text sm:text-[76px]">{dday}</b>
            <div className="min-w-0">
              <h2 className="text-2xl leading-tight font-extrabold">{title}</h2>
              <p className="text-sm text-muted-foreground">{recorded ? week.label : `${week.label} 예측`}</p>
            </div>
          </div>
          {shown.length > 0 && (
            <ul className="flex w-full max-w-md flex-col gap-1">
              {shown.map((row) => (
                <li key={row.name + row.amount} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate" title={row.name}>
                    {row.name}
                  </span>
                  {row.amount && <b className="shrink-0 whitespace-nowrap text-primary-text">{row.amount}</b>}
                </li>
              ))}
              {rows.length > shown.length && <li className="text-xs text-muted-foreground">외 {rows.length - shown.length}개</li>}
            </ul>
          )}
        </div>
        <div className="mx-auto flex flex-col items-center gap-1">
          <ul className="flex items-start pb-3 pl-5" aria-label={`${prediction.label} 테마별 나올 확률`}>
            {fan.map((t, i) => {
              const top = t.p === maxP;
              return (
                <li
                  key={t.id}
                  className={cn(
                    "relative -ml-5 flex h-[140px] w-[100px] flex-col justify-between rounded-xl bg-background p-3 shadow-lift sm:w-28",
                    i === 0 && "translate-y-2.5 -rotate-[5deg]",
                    i === 1 && "z-[1]",
                    i === 2 && "translate-y-3 rotate-[5deg]",
                  )}
                >
                  <span className={cn("text-xs font-semibold whitespace-nowrap text-muted-foreground", i === 2 && "text-right")}>{t.label}</span>
                  <b className={cn("font-num text-[26px] leading-none", i === 0 ? "text-left" : "text-right", top && "text-primary-text")}>{pct(t.p)}</b>
                  <span className="block h-1 overflow-hidden rounded-full bg-card" aria-hidden="true">
                    <span className={cn("block h-full rounded-full", top ? "bg-primary" : "bg-muted-foreground")} style={{ width: pct(t.p) }} />
                  </span>
                </li>
              );
            })}
          </ul>
          {recorded && <p className="text-xs text-muted-foreground">다음 주 {prediction.label} 예측</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {prediction.bigDays.map((d) => (
            <span key={d.id} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-background px-3 text-xs whitespace-nowrap text-muted-foreground">
              {d.label.replace(" 타임", "")} <b className="font-semibold text-foreground">{d.overdue ? "나올 때 지남" : d.when}</b>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {recorded && <NoticeImage images={recorded.images} label={week.label} icon={false} className={cn(PILL_LINK, "relative z-10 hover:no-underline")} />}
          {recorded?.noticeUrl && (
            <a href={recorded.noticeUrl} target="_blank" rel="noreferrer" className={cn(PILL_LINK, "relative z-10 pr-2")}>
              공지사항
              <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
            </a>
          )}
          <Link href="/sunday" aria-label="썬데이 메이플 자세히" className={cn(PILL_LINK, "relative z-10 pr-2")}>
            자세히
            <PillArrow />
          </Link>
        </div>
      </div>
    </section>
  );
}
