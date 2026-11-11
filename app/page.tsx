import Link from "next/link";
import { ArrowRight, Sun, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ThemeChip } from "@/components/sunday/sunday-view";
import { navGroups, type NavItem } from "@/lib/nav";
import { loadSundayWeeks } from "@/lib/sunday/live";
import { getSundayPageData } from "@/lib/sunday/view";

const incomeFeatures = [
  {
    title: "캡처 한 장으로 기록",
    description: "인벤토리 [기타] 탭 붙여넣기 → 사냥 메소 · 솔 에르다 조각 자동 입력",
  },
  {
    title: "0에서 시작하면 끝",
    description: "메소 · 조각을 비우고 사냥 → 끝나고 가진 만큼이 오늘 번 돈 · 주간 · 월간 합계",
  },
  {
    title: "보스 수익은 자동으로 빼기",
    description: "API 키가 있으면 오늘 판 결정석을 스케줄러로 찾아 사냥 수익에서 제외",
  },
  {
    title: "여러 계정 묶어 보기",
    description: "API 키 여러 개 등록 → 계정별 캐릭터 묶기",
  },
];

// The Sunday card depends on the clock (Friday notice, Sunday rollover), so re-render hourly.
export const revalidate = 3600;

export default async function Home() {
  const sunday = getSundayPageData(new Date(), await loadSundayWeeks());
  const recorded = sunday.thisWeek.recorded;
  const topThemes = [...sunday.prediction.themes].sort((a, b) => b.p - a.p).slice(0, 2);
  return (
    <div className="flex flex-col gap-4 lg:gap-[22px]">
      {/* The "이번 주 내 메이플" login card returns with member features (`members` branch). */}
      <h1 className="sr-only">메이플 대시보드</h1>

      <Link
        href="/sunday"
        className="flex flex-wrap items-center gap-3.5 rounded-lg border border-border bg-card px-[18px] py-3.5 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
          <Sun className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="flex min-w-[180px] flex-1 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">
            썬데이 메이플 · {recorded ? `${sunday.thisWeek.isToday ? "오늘" : "이번 주"} ${sunday.thisWeek.label}` : `${sunday.prediction.label} 예측`}
          </span>
          {recorded ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <b className="text-sm">{recorded.title}</b>
              {recorded.themes.map((id) => (
                <ThemeChip key={id} id={id} />
              ))}
            </span>
          ) : (
            <b className="flex flex-wrap gap-x-1.5 text-sm break-keep">
              <span>{sunday.prediction.headline ?? "뚜렷한 테마 없음"}</span>
              {topThemes.map((t) => (
                <span key={t.id} className="whitespace-nowrap">
                  · {t.label} {Math.round(t.p * 100)}%
                </span>
              ))}
            </b>
          )}
          {sunday.prediction.bigDays.length > 0 && (
            <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              {sunday.prediction.bigDays.map((d) => (
                <span key={d.id} className="whitespace-nowrap">
                  {d.label.replace(" 타임", "")} {d.overdue ? "나올 때 지남" : `${d.from} ~ ${d.to}`}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="text-xs font-semibold text-primary-text">자세히 →</span>
      </Link>

      {/* Coming-soon preview: no start button or how-to steps until 내 수익 exists. */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-2 text-[13px] font-bold text-primary-text">
              <Wallet className="size-4" aria-hidden="true" />
              내 수익
            </span>
            <h2 className="font-heading text-[20px] leading-snug font-bold lg:text-[22px]">
              오늘 번 메소, 캡처 한 장으로 기록
            </h2>
          </div>
          <Badge variant="outline" className="text-muted-foreground">
            준비 중
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {incomeFeatures.map((f) => (
            <div key={f.title} className="flex flex-col gap-1.5 rounded-lg bg-muted p-3.5">
              <b className="text-sm">{f.title}</b>
              <span className="text-xs leading-normal text-muted-foreground">{f.description}</span>
            </div>
          ))}
        </div>
      </section>

      {navGroups.map((group) => {
        const cards = group.items.filter((item) => item.card);
        if (cards.length === 0) return null;
        return (
          <section key={group.id} aria-label={group.label} className="flex flex-col gap-2.5">
            <h2 className="font-heading text-base font-bold">{group.label}</h2>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((item) => (
                <ToolCard key={item.slug} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ToolCard({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="group flex flex-col gap-2.5 rounded-lg border border-border bg-card p-[18px] transition-colors outline-none hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="flex items-center gap-1.5">
          {item.needs && <span className="text-xs text-muted-foreground">{item.needs}</span>}
          {!item.ready && (
            <Badge variant="outline" className="text-muted-foreground">
              준비 중
            </Badge>
          )}
        </span>
      </span>
      <b className="text-base">{item.card?.title}</b>
      <span className="text-[13px] leading-normal text-muted-foreground">{item.card?.description}</span>
      {item.ready && (
        <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary-text">
          열기 <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      )}
    </Link>
  );
}
