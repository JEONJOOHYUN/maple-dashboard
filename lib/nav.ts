import {
  Bell,
  Calculator,
  CircleDot,
  Crown,
  Gem,
  Hammer,
  House,
  ListChecks,
  ScanEye,
  ShieldAlert,
  Star,
  Sun,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  slug: string;
  /** Sidebar / header label. */
  label: string;
  /** Shorter label for the mobile sub-tab row. */
  short: string;
  href: string;
  icon: LucideIcon;
  /** Title and line on the home tool card (omit `card` to hide it from home). */
  card?: { title: string; description: string };
  /** What the tool needs: shown on the top-right of the home card. */
  needs?: "로그인" | "API 키" | "PC";
  /** false = placeholder "준비 중" page (app/[tool]/page.tsx). */
  ready: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export const homeItem: NavItem = {
  slug: "home",
  label: "홈",
  short: "홈",
  href: "/",
  icon: House,
  ready: true,
};

// Menu groups and order follow the confirmed redesign (spec §2). Add a tool here
// and it shows up in the sidebar, the mobile tabs and the home cards.
export const navGroups: NavGroup[] = [
  {
    id: "my",
    label: "내 메이플",
    items: [
      {
        slug: "income",
        label: "내 수익",
        short: "내 수익",
        href: "/income",
        icon: Wallet,
        card: { title: "내 수익", description: "캡처 한 장으로 오늘 · 주간 · 월간 사냥 수익" },
        needs: "로그인",
        ready: false,
      },
      {
        slug: "homework",
        label: "숙제 현황",
        short: "숙제",
        href: "/homework",
        icon: ListChecks,
        card: { title: "숙제 현황", description: "스케줄러로 남은 숙제를 자동으로" },
        needs: "API 키",
        ready: false,
      },
      {
        slug: "revenue",
        label: "보스 수익",
        short: "보스 수익",
        href: "/revenue",
        icon: Gem,
        card: { title: "보스 수익", description: "파티원별 결정석 수익 · 물욕 · 수익 달력" },
        needs: "API 키",
        ready: false,
      },
      {
        slug: "enhance",
        label: "강화 기록",
        short: "강화 기록",
        href: "/enhance",
        icon: Hammer,
        card: { title: "강화 기록", description: "스타포스 · 큐브, 기댓값보다 얼마나?" },
        needs: "API 키",
        ready: false,
      },
      {
        slug: "alerts",
        label: "알림 설정",
        short: "알림",
        href: "/alerts",
        icon: Bell,
        needs: "로그인",
        ready: false,
      },
    ],
  },
  {
    id: "calc",
    label: "계산기",
    items: [
      {
        slug: "boss-split",
        label: "분배금 계산기",
        short: "분배금 계산기",
        href: "/boss-split",
        icon: Calculator,
        card: { title: "분배금 계산기", description: "파티원 몫과 수수료를 한 번에 계산" },
        ready: true,
      },
      {
        slug: "ev",
        label: "기댓값 계산기",
        short: "기댓값 계산기",
        href: "/ev",
        icon: Star,
        card: { title: "기댓값 계산기", description: "스타포스 · 잠재 · 추옵 · 소울 · 어빌리티 평균 비용" },
        ready: true,
      },
      {
        slug: "mvp",
        label: "MVP 계산기",
        short: "MVP 계산기",
        href: "/mvp",
        icon: Crown,
        card: { title: "MVP 계산기", description: "다음 등급까지 얼마 · 마감까지 남은 시간" },
        ready: true,
      },
    ],
  },
  {
    id: "info",
    label: "정보 · 도우미",
    items: [
      {
        slug: "sunday",
        label: "썬데이 메이플",
        short: "썬데이 메이플",
        href: "/sunday",
        icon: Sun,
        card: { title: "썬데이 메이플", description: "이번 주 썬데이와 다음 혜택 예측" },
        ready: false,
      },
      {
        slug: "spec",
        label: "숨은 스펙업",
        short: "숨은 스펙업",
        href: "/spec",
        icon: ShieldAlert,
        card: { title: "숨은 스펙업", description: "닉네임으로 놓친 스펙 찾기" },
        ready: false,
      },
      {
        slug: "boss",
        label: "보스 도우미",
        short: "보스 도우미",
        href: "/boss",
        icon: ScanEye,
        card: { title: "보스 패턴 도우미", description: "화면을 보고 다음 패턴을 소리로 알려 줘요" },
        needs: "PC",
        ready: false,
      },
    ],
  },
  {
    id: "play",
    label: "놀이",
    items: [
      {
        slug: "pinball",
        label: "핀볼 추첨",
        short: "핀볼 추첨",
        href: "/pinball",
        icon: CircleDot,
        card: { title: "핀볼 추첨", description: "구슬을 굴려 드롭 주인 · 순서 정하기" },
        ready: true,
      },
    ],
  },
];

export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);

/** Pages that exist only as "준비 중" placeholders (menu tools + the login page). */
export const placeholderPages: { slug: string; title: string; description: string; icon?: LucideIcon }[] = [
  ...allNavItems
    .filter((item) => !item.ready)
    .map((item) => ({
      slug: item.slug,
      title: item.label,
      description: item.card?.description ?? "",
      icon: item.icon,
    })),
  {
    slug: "login",
    title: "로그인",
    description: "아이디 또는 API 키로 로그인할 수 있게 만들고 있어요.",
  },
];

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Group and item for the current path. Unknown paths (old pages) return null. */
export function findActive(pathname: string): { group: NavGroup; item: NavItem } | null {
  for (const group of navGroups) {
    const item = group.items.find((i) => matches(pathname, i.href));
    if (item) return { group, item };
  }
  return null;
}
