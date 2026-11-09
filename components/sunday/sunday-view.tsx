import { ExternalLink, Sparkles, Star, Sun, Swords, TriangleAlert, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { THEMES, type ThemeId } from "@/lib/sunday/bundles";
import type { OddsView, SundayPageData, WeekView } from "@/lib/sunday/view";
import { cn } from "@/lib/utils";

const THEME_ICON: Record<ThemeId, LucideIcon> = { starforce: Star, enhance: Sparkles, hunt: Swords };
const pct = (p: number) => `${Math.round(p * 100)}%`;
const EVENT_LIST = "https://maplestory.nexon.com/News/Event";

export function ThemeChip({ id, className }: { id: ThemeId; className?: string }) {
  const Icon = THEME_ICON[id];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-text", className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {THEMES.find((t) => t.id === id)?.day}
    </span>
  );
}

/** Benefits grouped like the theme bars above (starforce / option / hunting / other), each group by probability. */
function groupByTheme(ranked: OddsView[]) {
  const groups: { key: string; label: string; icon: LucideIcon | null; items: OddsView[] }[] = THEMES.map((t) => ({
    key: t.id,
    label: t.label,
    icon: THEME_ICON[t.id],
    items: ranked.filter((o) => o.theme === t.id),
  }));
  groups.push({ key: "etc", label: "기타", icon: null, items: ranked.filter((o) => !o.theme) });
  return groups.filter((g) => g.items.length);
}

function ago(o: OddsView) {
  const parts = [o.sinceWeeks == null ? "기록 없음" : o.sinceWeeks === 1 ? "지난주에 나옴" : `${o.sinceWeeks}주 전`];
  if (o.avgGap != null) parts.push(`평균 ${o.avgGap.toFixed(1)}주마다`);
  return parts.join(" · ");
}

export function SundayView({ data }: { data: SundayPageData }) {
  const { thisWeek, prediction, recent } = data;
  const picked = new Set(prediction.picks.map((p) => p.id));
  return (
    <div className="flex flex-col gap-4 break-keep lg:gap-[22px]">
      <PageHeader title="썬데이 메이플" description="이번 주 혜택 · 다음 썬데이 테마와 혜택 예측(참고용)" />

      <section className="grid grid-cols-1 overflow-hidden rounded-lg border border-primary bg-card lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <ThisWeek week={thisWeek} last={recent.find((w) => w.date < thisWeek.date)} />
        <Prediction prediction={prediction} />
      </section>

      {prediction.missingWeeks > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-[13px] leading-relaxed">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden="true" />
          기록이 {prediction.missingWeeks}주 밀려 있음({data.dataEnd} 까지) → 예측이 덜 정확함
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="sunday-ranked">
          <h2 id="sunday-ranked" className="px-[18px] py-3.5 text-[15px] font-bold">
            {prediction.label} 혜택별 나올 확률
          </h2>
          {groupByTheme(prediction.ranked).map((g) => (
            <div key={g.key}>
              <h3 className="flex items-center gap-1.5 border-t border-border bg-muted px-[18px] py-2 text-xs font-bold">
                {g.icon && <g.icon className="size-3.5 text-primary-text" aria-hidden="true" />}
                {g.label}
              </h3>
              <ul>
                {g.items.map((o) => (
                  <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_84px] items-center gap-2.5 border-t border-border px-[18px] py-2.5 text-[13px]">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <b>{o.label}</b>
                        {picked.has(o.id) && (
                          <span className="rounded-md bg-primary-soft px-1.5 text-[11px] font-semibold text-primary-text">3개에 포함</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{ago(o)}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <b className="font-num">{pct(o.p)}</b>
                      <span className="h-1.5 w-[84px] overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round(o.p * 200))}%` }} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="sunday-recent">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-[18px] py-3.5">
            <h2 id="sunday-recent" className="text-[15px] font-bold">
              최근 썬데이
            </h2>
            <span className="text-xs text-muted-foreground">공지 기준 기록</span>
          </div>
          <ul>
            {recent.map((w) => (
              <RecentRow key={w.date} week={w} current={w.date === thisWeek.date} />
            ))}
          </ul>
        </section>
      </div>

      <ul className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
        <li>
          기록 · 넥슨 썬데이 메이플 공지, 인벤 역대 썬데이메이플 정리 <span className="whitespace-nowrap">(2023-08 ~ {data.dataEnd})</span>
        </li>
        <li>예측 · 2025-03 스타포스 개편 이후 기록의 주기 통계</li>
        <li>적중 · 최근 52주 중 38주는 고른 3개 안에 실제 혜택 포함</li>
        <li>넥슨과 무관한 참고용 예측</li>
      </ul>
    </div>
  );
}

function ThisWeek({ week, last }: { week: SundayPageData["thisWeek"]; last?: WeekView }) {
  const r = week.recorded;
  return (
    <div className="flex flex-col gap-3.5 p-[18px] lg:p-6">
      <span className="inline-flex items-center gap-2 text-[13px] font-bold text-primary-text">
        <Sun className="size-4" aria-hidden="true" />
        {week.isToday ? "오늘" : "이번 주"} · {week.label}
        {r?.special && <span className="rounded-md border border-primary px-1.5 text-[11px]">스페셜</span>}
      </span>
      {r ? (
        <>
          <h2 className="font-num text-2xl leading-tight font-bold lg:text-[32px]">{r.title}</h2>
          {r.themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {r.themes.map((id) => (
                <ThemeChip key={id} id={id} />
              ))}
            </div>
          )}
          <ol className="flex flex-col gap-2">
            {r.items.map((text, i) => (
              <li key={text} className="flex items-baseline gap-2.5 text-sm leading-normal">
                <b className="font-num text-primary-text">{String(i + 1).padStart(2, "0")}</b>
                <span>{text}</span>
              </li>
            ))}
          </ol>
          {r.noticeUrl && <NoticeLink href={r.noticeUrl} />}
        </>
      ) : (
        <>
          <h2 className="font-num text-2xl leading-tight font-bold lg:text-[32px]">{week.announced ? "공지 나옴 · 기록 전" : "금요일 오전 10시 공지"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {week.announced ? "혜택은 넥슨 이벤트 공지에서 확인 → 기록되면 여기에 표시" : "공지 전 → 오른쪽 예측 참고"}
          </p>
          {week.announced && <NoticeLink href={EVENT_LIST} />}
          {last && (
            <div className="mt-auto flex flex-col gap-1.5 rounded-lg bg-muted px-3.5 py-3">
              <span className="text-xs text-muted-foreground">지난 썬데이 · {last.label}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                <b className="text-sm">{last.title}</b>
                {last.themes.map((id) => (
                  <ThemeChip key={id} id={id} />
                ))}
              </span>
              <span className="text-xs leading-normal text-muted-foreground">{last.detail}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NoticeLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 self-start rounded-sm text-[13px] font-semibold text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      넥슨 공지 보기
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

function Prediction({ prediction }: { prediction: SundayPageData["prediction"] }) {
  const maxP = Math.max(...prediction.themes.map((t) => t.p));
  return (
    <div className="flex flex-col gap-3 bg-muted p-[18px] lg:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <b className="text-sm">{prediction.label} 예측</b>
        <span className="text-xs font-semibold text-primary-text">{prediction.headline ?? "뚜렷한 테마 없음"}</span>
      </div>
      <span className="-mt-1 flex flex-col text-xs leading-relaxed text-muted-foreground">
        <span>테마마다 따로 낸 나올 확률</span>
        <span>같이 나오는 주가 많아 합은 100%를 넘음</span>
      </span>
      <ul className="flex flex-col gap-2" aria-label="테마별 나올 확률">
        {prediction.themes.map((t) => {
          const Icon = THEME_ICON[t.id];
          const top = t.p === maxP;
          return (
            <li key={t.id} className="grid grid-cols-[100px_minmax(0,1fr)_40px] items-center gap-2.5 text-[13px]">
              <span className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap">
                <Icon className={cn("size-4", top ? "text-primary-text" : "text-muted-foreground")} aria-hidden="true" />
                {t.label}
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-card" aria-hidden="true">
                <span className={cn("block h-full rounded-full", top ? "bg-primary" : "bg-muted-foreground/45")} style={{ width: pct(t.p) }} />
              </span>
              <b className="text-right font-num">{pct(t.p)}</b>
            </li>
          );
        })}
      </ul>
      <b className="mt-1 text-[13px]">나올 만한 혜택 3개</b>
      <ol className="flex flex-col gap-2">
        {prediction.picks.map((o, i) => (
          <li key={o.id} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg bg-card px-3 py-2.5">
            <b className="font-num text-lg text-primary-text">{i + 1}</b>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-sm">{o.label}</b>
              <span className="text-xs text-muted-foreground">{ago(o)}</span>
            </span>
            <b className="font-num text-[15px]">{pct(o.p)}</b>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RecentRow({ week, current }: { week: WeekView; current: boolean }) {
  return (
    <li className={cn("grid grid-cols-[64px_minmax(0,1fr)] items-baseline gap-2.5 border-t border-border px-[18px] py-2.5 text-[13px]", current && "bg-primary-soft")}>
      <span className="font-num text-muted-foreground">{week.label.replace(/\(.\)$/, "")}</span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <b>{week.title}</b>
          {week.special && <span className="rounded-md border border-border px-1.5 text-[11px] text-muted-foreground">스페셜</span>}
        </span>
        <span className="text-xs leading-normal text-muted-foreground">{week.detail || "이벤트 연계 혜택만"}</span>
      </span>
    </li>
  );
}
