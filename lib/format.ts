export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

const UNITS = ["", "만", "억", "조", "경", "해"] as const;

/**
 * Korean numbers change unit every 10,000 (만 · 억 · 조 · 경 · 해), so no unit shows more than four digits:
 * 21,510,700,000,000 → "21조 5,107억", 38,136 → "3만 8,136", 9,999 → "9,999".
 * `keep` = how many of the largest units stay (the rest is rounded away); Infinity keeps every unit.
 */
export function koreanUnits(value: number, keep = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  let n = Math.round(Math.abs(value));
  if (n < 10_000) return sign + n.toLocaleString("ko-KR");
  const top = (x: number) => Math.min(UNITS.length - 1, Math.floor(Math.log10(x) / 4 + 1e-9));
  let u = top(n);
  const lowest = Math.max(0, Number.isFinite(keep) ? u - keep + 1 : 0);
  if (lowest > 0) {
    const step = 10_000 ** lowest;
    n = Math.round(n / step) * step;
    u = top(n);
  }
  const parts: string[] = [];
  for (let i = u; i >= Math.max(lowest, 0); i--) {
    const group = i === u ? Math.floor(n / 10_000 ** i) : Math.floor(n / 10_000 ** i) % 10_000;
    if (group > 0) parts.push(group.toLocaleString("ko-KR") + UNITS[i]);
  }
  return sign + parts.join(" ");
}

export function formatKrw(value: number): string {
  return `${formatNumber(value)}원`;
}

// 좁은 공간(달력 칸 등)에 큰 메소 값을 표시하기 위한 축약 표기입니다.
export function formatCompactMeso(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_0000_0000) {
    return `${(value / 1_0000_0000).toFixed(1)}억`;
  }
  if (abs >= 1_0000) {
    return `${(value / 1_0000).toFixed(0)}만`;
  }
  return formatNumber(value);
}

// 입력값 확인용으로 "5억 메소", "1조 2,345억 4,750만 메소"처럼 만 · 억 · 조 · 경 단위로 풀어 씁니다.
export function formatKoreanMeso(value: number, { spaced = false } = {}): string {
  const rounded = Math.round(value);
  if (rounded <= 0) return "0 메소";

  const text = koreanUnits(rounded, Infinity);
  return `${spaced ? text : text.split(" ").join("")} 메소`;
}
