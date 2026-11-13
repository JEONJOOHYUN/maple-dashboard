import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { NoticeImage } from "@/components/sunday/notice-image";
import type { BigDayView, SundayPageData, WeekView } from "@/lib/sunday/view";

/**
 * This week's Sunday on the home page, once the notice is recorded (user, 2026-11-13): how many days are left,
 * and each benefit with its amount apart in bold. No title line: the benefits say what kind of day it is.
 * The whole card opens /sunday; "공지사항" goes to NEXON's notice, "원본 그림" opens the notice's picture in a window.
 */
export function SundayHomeCard({ week, recorded, bigDays }: { week: SundayPageData["thisWeek"]; recorded: WeekView; bigDays: BigDayView[] }) {
  const dday = week.daysLeft <= 0 ? "오늘" : `D-${week.daysLeft}`;
  return (
    <section aria-label="이번 주 썬데이 메이플" className="relative flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/60 sm:flex-row sm:items-stretch sm:gap-3.5 sm:p-3.5">
      <Link href="/sunday" aria-label="썬데이 메이플 자세히" className="absolute inset-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
      <div className="flex items-center gap-3.5 rounded-md bg-primary-soft px-4 py-3 sm:w-[220px] sm:shrink-0 sm:flex-col sm:items-start sm:justify-center sm:gap-2 sm:px-5 sm:py-[18px]">
        <b className="font-num text-[38px] leading-none whitespace-nowrap text-primary-text sm:order-2 sm:text-[50px]">{dday}</b>
        <span className="flex flex-wrap gap-x-1.5 text-[13px] sm:contents">
          <b className="text-primary-text sm:order-1 sm:text-xs">썬데이 메이플</b>
          <span className="sm:order-3">{week.label}</span>
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-1 sm:px-0 sm:pr-1.5">
        <ul className="flex flex-col">
          {recorded.rows.map((row) => (
            <li key={row.name + row.amount} className="flex items-baseline justify-between gap-3 border-b border-border py-[9px] text-[13.5px] leading-5 last:border-b-0 sm:text-sm">
              <span className="min-w-0">{row.name}</span>
              {row.amount && <b className="shrink-0 whitespace-nowrap text-primary-text">{row.amount}</b>}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
          {/* Phones: one window per line (user, 2026-11-14), the links on their own line under them. */}
          <span className="flex flex-col gap-y-0.5 sm:flex-row sm:flex-wrap sm:gap-x-2">
            {bigDays.map((d) => (
              <span key={d.id} className="whitespace-nowrap">
                {d.label.replace(" 타임", "")} <b className="text-foreground">{d.overdue ? "나올 때 지남" : d.when}</b>
              </span>
            ))}
          </span>
          {/* No update time here: only we need it (user, 2026-11-14) — on a phone it squeezed "공지사항" onto two lines. */}
          <span className="ml-auto flex basis-full items-center justify-end gap-3.5 sm:basis-auto">
            <NoticeImage images={recorded.images} label={week.label} className="relative z-10 -my-2 py-2 whitespace-nowrap" />
            {recorded.noticeUrl && (
              <a
                href={recorded.noticeUrl}
                target="_blank"
                rel="noreferrer"
                className="relative z-10 -my-2 inline-flex items-center gap-1 rounded-sm py-2 font-semibold whitespace-nowrap text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                공지사항
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
            <span className="font-semibold whitespace-nowrap text-primary-text">자세히 →</span>
          </span>
        </div>
      </div>
    </section>
  );
}
