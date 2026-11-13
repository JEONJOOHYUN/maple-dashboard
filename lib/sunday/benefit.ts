// A benefit line of the notice split into what it is and how much: "주문의 흔적 강화 비용 50% 할인" →
// "주문의 흔적 강화 비용" · "50% 할인". The home card shows the amount on the right, in bold (user, 2026-11-13).
// A line that does not end in an amount (미라클 타임, 썬데이메이플 선물 지급) keeps its whole text as the name.

/** "… 증가(1마리→3마리)": the change is in brackets at the end. */
const ARROW = /^(.*\S)\s*\(([^()]*→[^()]*)\)$/;
/**
 * The amount at the end of the line: a number with its unit (50% · 3배 · 2배로 · 10개 · 4장 · 1+1), "추가" or "+"
 * before it, and the words that say what happens to it after it. The name is matched lazily, so "추가 250%" keeps
 * its "추가"; a number in the middle of the line (경험치 3배 쿠폰(30분) 4장 지급) is not an amount.
 */
const TAIL = /^(.*?\S)\s+((?:추가\s)?\+?\d[\d,.+]*(?:%|배로|배|개|장|회|마리)?(?:\s(?:할인|지급|증가|감소|추가|누적|강화))*)$/;

export type BenefitRow = { name: string; amount: string };

export function splitBenefit(text: string): BenefitRow {
  const line = text.trim();
  const arrow = line.match(ARROW);
  if (arrow) return { name: arrow[1], amount: arrow[2].split("→").map((part) => part.trim()).join(" → ") };
  const tail = line.match(TAIL);
  return tail ? { name: tail[1], amount: tail[2] } : { name: line, amount: "" };
}
