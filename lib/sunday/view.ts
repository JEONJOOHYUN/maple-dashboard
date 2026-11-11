import { THEMES, bundleLabel, bundleTheme, isBigBundle, type ThemeId } from "./bundles.ts";
import { SUNDAYS, addWeeks, dateLabel, kstDate, noticeUrl, upcomingSunday, type SundayWeek } from "./history.ts";
import { bigDayWindow, predictSunday, themesOf, type BundleOdds } from "./predict.ts";

export type WeekView = {
  date: string;
  label: string;
  title: string;
  special: boolean;
  themes: ThemeId[];
  bundles: string[];
  /** One-line detail under the title: other bundles, or the raw benefits when the title already names the only bundle. */
  detail: string;
  items: string[];
  noticeUrl: string | null;
};

export type OddsView = BundleOdds & { label: string; theme: ThemeId | null };

/** "다음 샤이닝 스타포스 타임 11월 29일 ~ 12월 13일": the usual gap added to the last time it came. */
export type BigDayView = {
  id: string;
  label: string;
  /** Date range (labels) the usual gap points at; the range is over when `overdue`. */
  from: string;
  to: string;
  overdue: boolean;
  /** "보통 4~6주 간격" */
  gap: string;
  /** "지난 13번 중 8번" */
  record: string;
  lastLabel: string;
};

export type SundayPageData = {
  thisWeek: { date: string; label: string; isToday: boolean; announced: boolean; recorded: WeekView | null };
  prediction: {
    date: string;
    label: string;
    themes: { id: ThemeId; label: string; day: string; p: number }[];
    /** "사냥데이 유력" when one theme is likely enough, else null. */
    headline: string | null;
    picks: OddsView[];
    ranked: OddsView[];
    bigDays: BigDayView[];
    missingWeeks: number;
  };
  recent: WeekView[];
  dataEnd: string;
};

/** Theme probability needed before we call the week "○○데이 유력" (theme flags hit ~65% in backtests). */
const HEADLINE_P = 0.6;

function weekTitle(w: SundayWeek, themes: ThemeId[]): string {
  const big = [...w.bundles].find(isBigBundle);
  if (big) return bundleLabel(big);
  if (w.bundles.has("sol-erda-time")) return bundleLabel("sol-erda-time");
  if (!themes.length) return w.items.length ? "선물 · 기타 혜택" : "이벤트 연계 혜택만";
  const labels = themes.map((id) => THEMES.find((x) => x.id === id)!.label);
  return labels.join(" + ") + "데이";
}

export function weekView(w: SundayWeek): WeekView {
  const themes = themesOf(w);
  const title = weekTitle(w, themes);
  const others = [...w.bundles].map(bundleLabel).filter((l) => l !== title);
  return {
    date: w.date,
    label: dateLabel(w.date),
    title,
    special: w.special,
    themes,
    bundles: [...w.bundles].map(bundleLabel),
    detail: (others.length ? others : w.items.map((it) => it.name)).join(" · "),
    items: w.items.map((it) => it.name + (it.time ? ` (${it.time})` : "")),
    noticeUrl: w.notice.length ? noticeUrl(w.notice[w.notice.length - 1]) : null,
  };
}

const odds = (r: BundleOdds): OddsView => ({ ...r, label: bundleLabel(r.id), theme: bundleTheme(r.id) ?? null });

export function getSundayPageData(now: Date, weeks: SundayWeek[] = SUNDAYS): SundayPageData {
  const today = kstDate(now);
  const sunday = upcomingSunday(now);
  const recordedWeek = weeks.find((w) => w.date === sunday) ?? null;
  // The notice goes up on Friday 10:00 KST (= Friday 01:00 UTC), two days before the Sunday.
  const announced = now.getTime() >= Date.parse(sunday) - 2 * 86_400_000 + 3_600_000;
  // Predict this Sunday until it is recorded, then the next one.
  const target = recordedWeek ? addWeeks(sunday, 1) : sunday;
  const p = predictSunday(weeks, target);
  const themes = THEMES.map((x) => ({ id: x.id, label: x.label, day: x.day, p: p.themes[x.id] }));
  const top = [...themes].sort((a, b) => b.p - a.p)[0];
  const recent = weeks.filter((w) => w.date < sunday || w === recordedWeek).slice(-8).reverse();

  return {
    thisWeek: { date: sunday, label: dateLabel(sunday), isToday: today === sunday, announced, recorded: recordedWeek ? weekView(recordedWeek) : null },
    prediction: {
      date: target,
      label: dateLabel(target),
      themes,
      headline: top.p >= HEADLINE_P ? `${top.day} 유력` : null,
      // Shown from the most likely down (the model picks one per kind first, so its own order is not by chance).
      picks: p.picks.map((id) => odds(p.ranked.find((r) => r.id === id)!)).sort((x, y) => y.p - x.p),
      ranked: p.ranked.filter((r) => r.p >= 0.02).map(odds),
      bigDays: ["shining", "miracle"].flatMap((id) => {
        const w = bigDayWindow(weeks, id, target);
        if (!w?.last) return [];
        const to = addWeeks(w.last, w.maxWeeks);
        return [
          {
            id,
            label: bundleLabel(id),
            from: dateLabel(addWeeks(w.last, w.minWeeks)),
            to: dateLabel(to),
            overdue: target > to,
            gap: `보통 ${w.minWeeks}~${w.maxWeeks}주 간격`,
            record: `지난 ${w.total}번 중 ${w.covered}번`,
            lastLabel: dateLabel(w.last),
          },
        ];
      }),
      missingWeeks: p.missingWeeks,
    },
    recent: recent.map(weekView),
    dataEnd: weeks.at(-1)?.date ?? "",
  };
}
