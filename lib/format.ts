export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
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

// 입력값 확인용으로 "5억 메소", "4억7500만 메소"처럼 억/만 단위로 풀어 씁니다.
export function formatKoreanMeso(value: number): string {
  const rounded = Math.round(value);
  if (rounded <= 0) return "0 메소";

  const eok = Math.floor(rounded / 100_000_000);
  const afterEok = rounded % 100_000_000;
  const man = Math.floor(afterEok / 10_000);
  const rest = afterEok % 10_000;

  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok}억`);
  if (man > 0) parts.push(`${man}만`);
  if (rest > 0 || parts.length === 0) parts.push(`${rest}`);

  return `${parts.join("")} 메소`;
}
