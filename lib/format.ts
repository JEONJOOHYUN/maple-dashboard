export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

export function formatKrw(value: number): string {
  return `${formatNumber(value)}원`;
}
