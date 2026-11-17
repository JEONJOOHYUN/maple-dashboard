// "남은 기간" box of 숨은 스펙업 (시안 B, user 2026-11-17: "줄바꿈이나 글을 깔끔하게"): one title per kind, then
// rows of [what · date · days] so nothing wraps in the middle of a phrase. Red = the same thing is in 놓친 스펙.
import type { Period } from "./check.ts";

// Stat cash items: warned like titles, under 7 days (their days left are always shown apart, user 2026-11-17).
// Kept here, not in check.ts: the page imports this file, and check.ts carries the class data and the icon table.
export const PERIOD_WARN_DAYS = 7;

export type PeriodRow = { what: string; date: string; days: string; warn: boolean };
export type PeriodGroup = { title: string; /** Right of the title (마스터라벨 플러스 only). */ value?: string; warn: boolean; rows: PeriodRow[]; notes: string[] };

const md = (at: string) => (at ? `${Number(at.slice(5, 7))}/${Number(at.slice(8, 10))}` : "");

/** Things ending on the same day share a row: "상의 · 신발 · 무기 · 5/14 · 179일". */
function rowsOf(list: Period[], name: (p: Period) => string, warnAt: (days: number) => boolean): PeriodRow[] {
  const byDate = new Map<string, Period[]>();
  for (const p of list) byDate.set(p.at, [...(byDate.get(p.at) ?? []), p]);
  return [...byDate.values()]
    .sort((a, b) => a[0].days - b[0].days || a[0].at.localeCompare(b[0].at))
    .map((ps) => {
      const days = Math.min(...ps.map((p) => p.days));
      return { what: [...new Set(ps.map(name))].join(" · "), date: md(ps[0].at), days: days < 0 ? "끝남" : `${days}일`, warn: warnAt(days) };
    });
}

/** `labelPlus` null = unknown (other-stat failed): no 마스터라벨 플러스 group then. */
export function periodGroups(periods: Period[], labelPlus: string[] | null): PeriodGroup[] {
  const of = (kind: Period["kind"]) => periods.filter((p) => p.kind === kind);
  const cashWarn = (d: number) => d < PERIOD_WARN_DAYS;
  const out: PeriodGroup[] = [];
  const push = (title: string, list: Period[], name: (p: Period) => string, warnAt: (d: number) => boolean) => {
    if (!list.length) return;
    const rows = rowsOf(list, name, warnAt);
    out.push({ title, warn: rows.some((r) => r.warn), rows, notes: [] });
  };
  push("마스터라벨 능력치", of("label"), (p) => p.slot || p.name, cashWarn);
  push("캐시 장비 능력치", of("cashStat"), (p) => p.name, cashWarn);
  push("캐시 장비 기간", of("cashItem"), (p) => p.name, cashWarn);
  const pets = of("pet");
  push(`펫 ${new Set(pets.map((p) => p.name)).size}마리`, pets, (p) => p.name, (d) => d < 0);

  const labels = of("label").filter((p) => p.days >= 0);
  if (labelPlus && (labelPlus.length || labels.length)) {
    const combat = labelPlus.some((x) => x.startsWith("전투 플러스"));
    const kinds = labelPlus.map((x) => x.split(" · ")[0].replace(" 플러스", ""));
    const count = labelPlus.map((x) => x.match(/마라벨 (\d)개/)?.[1]).find(Boolean);
    out.push({
      title: "마스터라벨 플러스",
      value: combat ? "켜짐" : labelPlus.length ? "성장만" : "꺼짐",
      warn: !combat && labels.length > 0,
      rows: [],
      notes: labelPlus.length
        ? [`${kinds.join(" · ")}${count ? ` · 마라벨 ${count}개 기준` : ""}`]
        : ["성장 · 전투 둘 다 없음"],
    });
  }
  return out;
}
