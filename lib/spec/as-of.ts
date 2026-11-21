// A result made from a past day's data: NEXON was under maintenance, so yesterday's was used (lib/nexon/api.ts
// liveOrYesterday). The date itself is shown rather than "어제": the page may be read after midnight.

/** "2026-11-19" → "11/19 데이터 · 넥슨 점검 중". */
export function asOfLabel(asOf: string): string {
  const [, month, day] = asOf.split("-");
  return `${Number(month)}/${Number(day)} 데이터 · 넥슨 점검 중`;
}
