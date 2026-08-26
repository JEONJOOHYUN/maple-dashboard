export type Tool = {
  slug: string;
  label: string;
  href: string;
  description: string;
};

// 새 메이플 도구를 추가할 때 이 배열에만 항목을 더하면
// 상단 탭과 홈 화면 카드에 자동으로 반영됩니다.
export const tools: Tool[] = [
  {
    slug: "settlement",
    label: "부주 정산",
    href: "/settlement",
    description: "일일 사냥 기록을 누적하고, 실시간 시세로 정산 금액을 계산합니다.",
  },
  {
    slug: "boss-split",
    label: "보스 분배금",
    href: "/boss-split",
    description: "아이템 판매액을 파티원끼리 나눌 때 수수료까지 반영해 분배금을 계산합니다.",
  },
];
