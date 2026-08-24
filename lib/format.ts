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
