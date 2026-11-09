// Sunday Maple benefits are predicted per "bundle": groups that (almost) always appear together count as one,
// and each bundle belongs to one theme shown on the screen. Chosen from history co-occurrence (2023-08 ~ 2026-11):
// rune buff + combo kill came together 46/46 times, elite monsters only ever came with monster collection, etc.

export type ThemeId = "starforce" | "enhance" | "hunt";

export const THEMES: { id: ThemeId; label: string; day: string; hint: string }[] = [
  { id: "starforce", label: "스타포스", day: "스타포스데이", hint: "스타포스 할인 · 파괴 감소 · 샤이닝" },
  // "enhance" = enhancing other than starforce: potential, ability, soul, scroll stats, HEXA stat are all options/stats,
  // so "옵션 강화" (starforce raises star levels instead). "강화" alone read as including starforce (user, 2026-11-10).
  { id: "enhance", label: "옵션 강화", day: "옵션 강화데이", hint: "미라클 · 어빌리티 · 소울 · 주문의 흔적 · HEXA" },
  { id: "hunt", label: "사냥", day: "사냥데이", hint: "룬 · 몬스터파크 · 트레져 헌터 · 솔 에르다" },
];

type BundleInfo = { label: string; theme?: ThemeId; big?: boolean };

/** Bundle id -> display label and theme. `big` = shining / miracle, the rare all-day events predicted as their own cycle. */
export const BUNDLES: Record<string, BundleInfo> = {
  shining: { label: "샤이닝 스타포스 타임", theme: "starforce", big: true },
  miracle: { label: "미라클 타임", theme: "enhance", big: true },
  "starforce-sale": { label: "스타포스 강화 비용 30% 할인", theme: "starforce" },
  "starforce-1plus1": { label: "10성 이하 스타포스 1+1 강화", theme: "starforce" },
  "starforce-100": { label: "5 · 10 · 15성 강화 100% 성공", theme: "starforce" },
  "starforce-destroy": { label: "21성 이하 파괴 확률 30% 감소", theme: "starforce" },
  "trace-restore": { label: "흔적 복구 비용 20% 할인", theme: "starforce" },
  "spell-trace": { label: "주문의 흔적 강화 비용 할인", theme: "enhance" },
  ability: { label: "어빌리티 재설정 비용 50% 할인", theme: "enhance" },
  soul: { label: "위대한 소울 획득 확률 5배", theme: "enhance" },
  "hexa-stat": { label: "HEXA 스탯 강화 확률 20% 증가", theme: "enhance" },
  "potential-cost": { label: "잠재능력 감정 · 재설정 비용 할인", theme: "enhance" },
  rune: { label: "룬 · 콤보킬 경험치", theme: "hunt" },
  "monster-park": { label: "몬스터파크 클리어 경험치 추가", theme: "hunt" },
  treasure: { label: "트레져 헌터", theme: "hunt" },
  "sol-erda-hunt": { label: "사냥 솔 에르다 획득량 증가", theme: "hunt" },
  "sol-erda-time": { label: "솔 에르다 타임", theme: "hunt" },
  collection: { label: "몬스터 컬렉션 · 엘리트 몬스터", theme: "hunt" },
  bounty: { label: "현상금 사냥 · 불꽃늑대 경험치", theme: "hunt" },
  "extreme-levelup": { label: "익스트림 레벨업 타임", theme: "hunt" },
  "exp-allday": { label: "하루 종일 경험치 2배", theme: "hunt" },
  "arcane-daily": { label: "아케인리버 일일 보상 2배", theme: "hunt" },
  gift: { label: "아이템 선물" },
};

/** Benefit group (benefits.json) -> bundle id, for groups that merge into a bigger bundle. */
const GROUP_TO_BUNDLE: Record<string, string> = {
  "rune-buff": "rune",
  combo: "rune",
  "rune-cooldown": "rune",
  "rune-duration": "rune",
  "flame-wolf": "bounty",
  elite: "collection",
  "treasure-exp": "treasure",
  "treasure-spawn": "treasure",
  "exp-coupon": "gift",
  symbol: "gift",
  "growth-potion": "gift",
};

export type HistoryItem = { name: string; tags?: string[]; time?: string };

/** Bundle of one history item: the shining / sol erda time tags win over the item's own group. */
export function bundleOf(item: HistoryItem, groupOfName: (name: string) => string): string {
  const tag = item.tags?.[0];
  if (tag === "샤이닝 스타포스 타임") return "shining";
  if (tag === "솔 에르다 타임") return "sol-erda-time";
  const group = groupOfName(item.name);
  return GROUP_TO_BUNDLE[group] ?? group;
}

export const bundleLabel = (id: string) => BUNDLES[id]?.label ?? id;
export const bundleTheme = (id: string) => BUNDLES[id]?.theme;
export const isBigBundle = (id: string) => BUNDLES[id]?.big === true;
