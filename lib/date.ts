/**
 * 오늘 날짜를 한국 시간(Asia/Seoul) 기준 "YYYY-MM-DD"로 반환합니다.
 *
 * new Date().toISOString()은 UTC 기준이라 한국에서 자정~오전 9시 사이에는
 * 어제 날짜가 나옵니다. 또한 서버(Vercel: UTC)와 브라우저(KST)의 로컬 시간대가
 * 달라 SSR/CSR 결과가 어긋나므로, 시간대를 명시해 양쪽이 항상 같은 값을
 * 내도록 합니다. (sv-SE 로케일이 YYYY-MM-DD 형식입니다)
 */
export function todayInSeoul(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}
