// What a member is told when a NEXON key kept with the account stopped working: the same words on every page that
// reads with those keys (숙제 현황, 보스 수익). Both are fixed on 내 정보, not on the page that noticed.
export const KEPT_KEY_PROBLEMS = {
  badKey: "API 키가 올바르지 않음 → 내 정보에서 키 교체",
  /** The kept key does not open (sealed with another secret, or the row was changed). */
  locked: "보관한 키를 열 수 없음 → 내 정보에서 다시 등록",
} as const;
