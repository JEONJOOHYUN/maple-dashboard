import { ExternalLink, Sparkles, Star, Sun, Swords, TriangleAlert, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NoticeImage } from "@/components/sunday/notice-image";
import { THEMES, type ThemeId } from "@/lib/sunday/bundles";
import { dateLabel } from "@/lib/sunday/history";
import { hitChange, hitChangeLabel, hitRate, type HitKey, type WeekHit } from "@/lib/sunday/hits";
import type { OddsView, SundayPageData, WeekView } from "@/lib/sunday/view";
import { Digits } from "@/components/ui/digits";
import { cn } from "@/lib/utils";

const THEME_ICON: Record<ThemeId, LucideIcon> = { starforce: Star, enhance: Sparkles, hunt: Swords };
const pct = (p: number) => `${Math.round(p * 100)}%`;
const EVENT_LIST = "https://maplestory.nexon.com/News/Event";

export function ThemeChip({ id, className }: { id: ThemeId; className?: string }) {
  const Icon = THEME_ICON[id];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md bg-primary-soft pr-2 pl-1.5 py-0.5 text-xs font-semibold text-primary-text", className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {THEMES.find((t) => t.id === id)?.day}
    </span>
  );
}

/** Benefits grouped like the theme tiles above (starforce / option / hunting / other), each group by probability. */
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
    <div className="flex flex-col gap-2 break-keep">
      <PageHeader title="썬데이 메이플" description="이번 주 혜택 · 다음 썬데이 테마와 혜택 예측(참고용)" />

      {/* Full-width bands, so neither side runs empty before the notice (Mon 00:00 ~ Fri) or after it. */}
      <div className="flex flex-col gap-3.5">
        {thisWeek.recorded && <ThisWeekBand week={thisWeek} recorded={thisWeek.recorded} />}
        <ThemeBand week={thisWeek} prediction={prediction} />
        <PicksBand picks={prediction.picks} hits={prediction.hits} />
        <Outlook bigDays={prediction.bigDays} last={thisWeek.recorded ? undefined : recent.find((w) => w.date < thisWeek.date)} />
      </div>

      {prediction.missingWeeks > 0 && (
        <p className="flex items-start gap-2 rounded-lg tile-edge bg-muted px-4 py-3 text-[13px] leading-relaxed">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden="true" />
          기록이 {prediction.missingWeeks}주 밀려 있음({data.dataEnd} 까지) → 예측이 덜 정확함
        </p>
      )}

      {/* Side by side the two cards end on one line (user 2026-11-15): the recent list fills the odds card's height and
          scrolls inside. It is positioned absolute in a flex-1 box, so it never makes the row taller (h-0 + flex-1 did:
          a % flex-basis turns into the content height while the row is sized). */}
      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2 lg:items-stretch">
        <section className="overflow-hidden tile" aria-labelledby="sunday-ranked">
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
                          <span className="rounded-md bg-primary-soft px-1.5 text-[11px] font-semibold text-primary-text">5개에 포함</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{ago(o)}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <b className="font-num"><Digits>{pct(o.p)}</Digits></b>
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

        <section className="flex flex-col overflow-hidden tile" aria-labelledby="sunday-recent">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-[18px] py-3.5">
            <h2 id="sunday-recent" className="text-[15px] font-bold">
              최근 썬데이
            </h2>
            <span className="text-xs text-muted-foreground">공지 기준 기록</span>
          </div>
          <div className="lg:relative lg:min-h-0 lg:flex-1">
            <ul className="lg:absolute lg:inset-0 lg:overflow-y-auto">
              {recent.map((w, i) => (
                <RecentRow key={w.date} week={w} current={w.date === thisWeek.date} wideOnly={i >= 8} />
              ))}
            </ul>
          </div>
        </section>
      </div>

      <ul className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
        <li>
          기록 · 넥슨 썬데이 메이플 공지 <span className="whitespace-nowrap">(2023-08 ~ {data.dataEnd})</span>
        </li>
        <li>
          예측 · 2025-03 스타포스 개편 이후 기록의 주기 통계{data.prediction.ml ? " + AI 모델(TabICL · TabPFN)" : ""}
        </li>
        <li>샤이닝 · 미라클 예상 · 지난번 + 평소 간격, 간격이 일정하지 않아 범위로 표시</li>
        <li>넥슨과 무관한 참고용 예측 · Built with PriorLabs-TabPFN</li>
      </ul>
    </div>
  );
}

const BAND_TITLE = "font-num text-[28px] leading-tight font-bold lg:text-[32px] xl:text-[40px]";
const EYEBROW = "inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold text-primary-text";

/** This Sunday's recorded benefits (shown once the notice is recorded). */
function ThisWeekBand({ week, recorded: r }: { week: SundayPageData["thisWeek"]; recorded: WeekView }) {
  return (
    <section className="grid grid-cols-1 gap-4 rounded-[1rem] border border-primary bg-card p-[18px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center lg:gap-6 lg:p-6">
      <div className="flex flex-col gap-2.5">
        <span className={EYEBROW}>
          <Sun className="size-4" aria-hidden="true" />
          {week.isToday ? "오늘" : "이번 주"} · {week.label}
          {r.special && <span className="rounded-md border border-primary px-1.5 text-[11px]">스페셜</span>}
        </span>
        <h2 className={BAND_TITLE}>{r.title}</h2>
        {/* No update time: only we need it (user, 2026-11-14), as on the home card. */}
        {(r.themes.length > 0 || r.noticeUrl || r.images.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {r.themes.map((id) => (
              <ThemeChip key={id} id={id} />
            ))}
            {r.noticeUrl && <NoticeLink href={r.noticeUrl} />}
            <NoticeImage images={r.images} label={week.label} className="text-[13px]" />
          </div>
        )}
      </div>
      <ol className="flex flex-col gap-2">
        {r.items.map((text, i) => (
          <li key={text} className="flex items-baseline gap-2.5 rounded-lg bg-muted px-3.5 py-2.5 text-sm leading-normal lg:text-[15px]">
            {/* Never narrower than its two digits: next to a line that wraps, "01" broke into "0" over "1" on a phone. */}
            <b className="shrink-0 font-num whitespace-nowrap text-primary-text">{String(i + 1).padStart(2, "0")}</b>
            <span>{text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Theme outlook for the predicted Sunday: this one until its notice is recorded, then the next. */
function ThemeBand({ week, prediction }: { week: SundayPageData["thisWeek"]; prediction: SundayPageData["prediction"] }) {
  const recorded = week.recorded != null;
  const maxP = Math.max(...prediction.themes.map((t) => t.p));
  return (
    <section
      className={cn(
        "grid grid-cols-1 gap-4 tile p-[18px] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6 lg:p-6",
        recorded ? "" : "border-primary",
      )}
    >
      <div className="flex flex-col gap-2.5">
        {recorded ? (
          <span className={EYEBROW}>다음 주 · {prediction.label} 예측</span>
        ) : (
          <span className={EYEBROW}>
            <Sun className="size-4" aria-hidden="true" />
            <span>
              {week.isToday ? "오늘" : "이번 주"} · {week.label}
            </span>
            <span>· {week.announced ? "공지 나옴 · 기록 전" : "금요일 오전 10시 공지"}</span>
          </span>
        )}
        <h2 className={BAND_TITLE}>{prediction.headline ?? "뚜렷한 테마 없음"}</h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">테마마다 따로 낸 확률 · 같이 나오는 주가 많아 합은 100%를 넘음</p>
        {!recorded && week.announced && <NoticeLink href={EVENT_LIST} />}
      </div>
      <ul className="grid grid-cols-3 gap-2 lg:grid-cols-[repeat(3,140px)] lg:gap-2.5 xl:grid-cols-[repeat(3,176px)]" aria-label="테마별 나올 확률">
        {prediction.themes.map((t) => {
          const Icon = THEME_ICON[t.id];
          const top = t.p === maxP;
          return (
            <li key={t.id} className={cn("flex flex-col gap-2 rounded-lg border p-2.5 lg:p-4", top ? "border-primary bg-primary-soft" : "tile-edge bg-muted")}>
              <span className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap lg:gap-1.5 lg:text-[13px]">
                <Icon className={cn("size-3.5 shrink-0 lg:size-4", top ? "text-primary-text" : "text-muted-foreground")} aria-hidden="true" />
                {t.label}
              </span>
              <b className={cn("font-num text-[28px] leading-tight lg:text-4xl", top && "text-primary-text")}>{pct(t.p)}</b>
              <span className="h-1.5 overflow-hidden rounded-full bg-card" aria-hidden="true">
                <span className={cn("block h-full rounded-full", top ? "bg-primary" : "bg-muted-foreground/60")} style={{ width: pct(t.p) }} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Card label of each kind; "스페셜": shining and miracle came only on Special Sundays (32 of 32 since 2023-08). */
const KIND_LABEL: Record<OddsView["kind"], string> = { big: "스페셜", hunt: "사냥", enhance: "강화", other: "기타" };

type Hits = SundayPageData["prediction"]["hits"];

/** The likeliest benefit of each kind as cards 1 ~ 3 (side by side on wide screens), then two more as short rows. */
function PicksBand({ picks, hits }: { picks: OddsView[]; hits: Hits }) {
  const top = picks.slice(0, 3);
  const rest = picks.slice(3);
  // A single benefit is unlikely on its own (2 ~ 3 of ~15 come a week), so the sure part comes first: how often the
  // cards held a real benefit over the last 52 Sundays (user 2026-11-15: the numbers should look good, honestly), with
  // the change since last week and the last 12 Sundays as dots. The period sits at the right end of the title row,
  // over the boxes' right edge like "최근 썬데이 · 공지 기준 기록" below, and says 적중률 so it is not read as the period
  // the predictions come from (user 2026-11-17: "최근 1년" reads better than "최근 52주"). A year covers each season
  // once (summer / winter patch big days).
  const period = hits.weeks === 52 ? "최근 1년 적중률" : `최근 ${hits.weeks}주 적중률`;
  return (
    <section className="flex flex-col gap-3 tile p-[18px] lg:px-6 lg:py-5" aria-labelledby="sunday-picks">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 lg:max-w-md">
          <h2 id="sunday-picks" className="text-[15px] font-bold">
            나올 만한 혜택
          </h2>
          <span className="text-xs text-muted-foreground">{period}</span>
        </div>
        <dl className="grid grid-cols-2 gap-2 lg:max-w-md">
          <HitStat label="1 ~ 3 중 하나 이상 적중" hits={hits} pick="top3" />
          <HitStat label="5개 중 하나 이상 적중" hits={hits} pick="five" />
        </dl>
      </div>
      <ol className="grid grid-cols-1 gap-2 lg:grid-cols-3 lg:gap-2.5">
        {top.map((o, i) => (
          <li key={o.id} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-2.5 rounded-lg bg-muted px-3.5 py-3">
            <b className="font-num text-[22px] leading-tight text-primary-text">{i + 1}</b>
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary-text">{KIND_LABEL[o.kind]}</span>
                <span className="text-xs text-muted-foreground">{ago(o)}</span>
              </span>
              <span className="flex items-baseline justify-between gap-2.5">
                <b className="min-w-0 text-[15px]">{o.label}</b>
                <b className="font-num shrink-0 text-[22px]"><Digits>{pct(o.p)}</Digits></b>
              </span>
            </span>
          </li>
        ))}
      </ol>
      {rest.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg tile-edge px-3.5 py-3">
          <h3 className="text-xs font-bold text-muted-foreground">그 밖에 유력</h3>
          <ol className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-x-6">
            {rest.map((o, i) => (
              <li key={o.id} className="grid grid-cols-[28px_minmax(0,1fr)_44px] items-center gap-2.5">
                <span className="font-num text-[15px] font-bold text-muted-foreground">{i + 4}</span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-[13px]">{o.label}</span>
                  <span className="h-1 rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-1 rounded-full bg-muted-foreground" style={{ width: pct(o.p) }} />
                  </span>
                </span>
                <span className="font-num text-right text-[13px] font-bold"><Digits>{pct(o.p)}</Digits></span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/** One rate of the hit record: the percent, its change since last week and the last 12 Sundays as dots. */
function HitStat({ label, hits, pick }: { label: string; hits: Hits; pick: HitKey }) {
  return (
    // Bottom-aligned, so the numbers and dots of both boxes stay on one line when a label wraps (320 px); on a narrow
    // box the chip moves under the number instead of squeezing it.
    <div className="flex flex-col justify-between gap-1 rounded-lg bg-primary-soft px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <b className="shrink-0 font-num text-xl font-bold whitespace-nowrap text-primary-text">{hitRate(hits[pick], hits.weeks)}%</b>
          <HitChange change={hitChange(hits, pick)} />
        </span>
        {/* "최근 12주" right of the dots (user 2026-11-17); a phone box is too narrow, so there it wraps under them. */}
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <HitDots marks={hits.marks} pick={pick} />
          <span aria-hidden="true" className="text-[11px] leading-none whitespace-nowrap text-muted-foreground">
            최근 {hits.marks.length}주
          </span>
        </span>
      </dd>
    </div>
  );
}

const CHANGE_CHIP = "rounded-full bg-card px-2 text-[11px] leading-[18px] font-bold whitespace-nowrap";
const CHANGE_TONE = { none: "text-muted-foreground", same: "text-muted-foreground", up: "text-gain", down: "text-loss" } as const;

/** "-" before there is a last week to compare, "유지" when the same, "▲ 2%" / "▼ 2%" (hits.ts hitChangeLabel). */
function HitChange({ change }: { change: number | null }) {
  const { text, tone, spoken } = hitChangeLabel(change);
  return (
    <span className={cn(CHANGE_CHIP, CHANGE_TONE[tone])}>
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}

/** The last 12 recorded Sundays, oldest left: filled = held a benefit, ring = missed; hovering one names its Sunday.
 * Scales down on screens too narrow for its 117 px. */
function HitDots({ marks, pick }: { marks: WeekHit[]; pick: HitKey }) {
  const width = marks.length * 10 - 3;
  const hit = marks.filter((m) => m[pick]).length;
  return (
    <svg
      viewBox={`0 0 ${width} 8`}
      preserveAspectRatio="xMinYMid meet"
      className="h-2 w-full"
      style={{ maxWidth: width }}
      role="img"
      aria-label={`최근 ${marks.length}주 중 ${hit}주 적중`}
    >
      {marks.map((m, i) =>
        m[pick] ? (
          <circle key={m.date} cx={3.5 + i * 10} cy={4} r={3.5} className="fill-primary-text">
            <title>{`${dateLabel(m.date)} 적중`}</title>
          </circle>
        ) : (
          <circle key={m.date} cx={3.5 + i * 10} cy={4} r={2.75} strokeWidth={1.5} className="fill-none stroke-muted-foreground">
            <title>{`${dateLabel(m.date)} 빗나감`}</title>
          </circle>
        ),
      )}
    </svg>
  );
}

const OUTLOOK_CARD = "flex flex-col gap-1.5 tile px-[18px] py-4";

/** When shining / miracle are due, plus last Sunday while this week's notice is not recorded yet. */
function Outlook({ bigDays, last }: { bigDays: SundayPageData["prediction"]["bigDays"]; last?: WeekView }) {
  const count = bigDays.length + (last ? 1 : 0);
  if (!count) return null;
  return (
    <div className={cn("grid grid-cols-1 gap-3.5", count === 2 && "sm:grid-cols-2", count >= 3 && "md:grid-cols-3")}>
      {bigDays.map((d) => (
        <section key={d.id} className={OUTLOOK_CARD}>
          <h2 className="text-xs font-normal text-muted-foreground">{d.label} 예상</h2>
          <b className="font-num text-2xl leading-tight text-primary-text">{d.overdue ? "나올 때 지남" : d.when}</b>
          <span className="text-xs leading-normal text-muted-foreground">
            지난번 {d.lastLabel} · {d.gap} ({d.record})
          </span>
        </section>
      ))}
      {last && (
        <section className={OUTLOOK_CARD}>
          <h2 className="text-xs font-normal text-muted-foreground">지난 썬데이 · {last.label}</h2>
          <b className="font-num text-2xl leading-tight">{last.title}</b>
          <span className="text-xs leading-normal text-muted-foreground">{last.detail || "이벤트 연계 혜택만"}</span>
        </section>
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

function RecentRow({ week, current, wideOnly }: { week: WeekView; current: boolean; wideOnly: boolean }) {
  return (
    <li
      className={cn(
        "grid-cols-[64px_minmax(0,1fr)] items-baseline gap-2.5 border-t border-border px-[18px] py-2.5 text-[13px]",
        wideOnly ? "hidden lg:grid" : "grid",
        current && "bg-primary-soft",
      )}
    >
      <span className="font-num text-muted-foreground">{week.label.replace(/\(.\)$/, "")}</span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <b>{week.title}</b>
          {week.special && <span className="rounded-md tile-edge px-1.5 text-[11px] text-muted-foreground">스페셜</span>}
        </span>
        <span className="text-xs leading-normal text-muted-foreground">{week.detail || "이벤트 연계 혜택만"}</span>
      </span>
    </li>
  );
}
