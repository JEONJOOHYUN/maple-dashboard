import assert from "node:assert/strict";
import { test } from "node:test";
import { splitBenefit } from "./benefit.ts";
import { SUNDAYS } from "./history.ts";

test("a benefit line splits into its name and the amount at its end", () => {
  const split = (text: string) => {
    const { name, amount } = splitBenefit(text);
    return [name, amount];
  };
  assert.deepEqual(split("주문의 흔적 강화 비용 50% 할인"), ["주문의 흔적 강화 비용", "50% 할인"]);
  assert.deepEqual(split("몬스터 파크 클리어 경험치 추가 250%"), ["몬스터 파크 클리어 경험치", "추가 250%"]);
  assert.deepEqual(split("룬 경험치 버프 효과 +100%"), ["룬 경험치 버프 효과", "+100%"]);
  assert.deepEqual(split("몬스터 컬렉션 '의문의 모몽' 3개 지급"), ["몬스터 컬렉션 '의문의 모몽'", "3개 지급"]);
  assert.deepEqual(split("사냥 시 소환되는 엘리트 몬스터 수 증가(1마리→3마리)"), ["사냥 시 소환되는 엘리트 몬스터 수 증가", "1마리 → 3마리"]);
  assert.deepEqual(split("사냥을 통해 획득할 수 있는 솔 에르다 2배로 증가"), ["사냥을 통해 획득할 수 있는 솔 에르다", "2배로 증가"]);
  assert.deepEqual(split("10성 이하에서 스타포스 강화 성공 시 1+1 강화"), ["10성 이하에서 스타포스 강화 성공 시", "1+1 강화"]);
  assert.deepEqual(split("누적 접속 시간 2시간 달성 시, 솔 에르다 조각 교환권 10개 추가 지급"), ["누적 접속 시간 2시간 달성 시, 솔 에르다 조각 교환권", "10개 추가 지급"]);
  // A number in the middle is not the amount: only the one the line ends with.
  assert.deepEqual(split("경험치 3배 쿠폰(30분) 4장 지급"), ["경험치 3배 쿠폰(30분)", "4장 지급"]);
  assert.deepEqual(split("스타포스 5, 10, 15성에서 강화 시도 시 성공확률 100%"), ["스타포스 5, 10, 15성에서 강화 시도 시 성공확률", "100%"]);
  assert.deepEqual(split("21성 이하에서 스타포스 강화 시 파괴 확률 30% 감소"), ["21성 이하에서 스타포스 강화 시 파괴 확률", "30% 감소"]);
  // No amount at the end: the whole line is the name.
  assert.deepEqual(split("미라클 타임"), ["미라클 타임", ""]);
  assert.deepEqual(split("썬데이메이플 선물 지급"), ["썬데이메이플 선물 지급", ""]);
  assert.deepEqual(split("룬 재등장 및 재사용 대기시간 감소"), ["룬 재등장 및 재사용 대기시간 감소", ""]);
});

test("every benefit recorded so far keeps all of its text, with a short amount or none", () => {
  for (const week of SUNDAYS)
    for (const item of week.items) {
      const { name, amount } = splitBenefit(item.name);
      assert.ok(name.length > 0, item.name);
      assert.ok(amount.length <= 12, `${item.name} → ${amount}`);
      // Nothing is lost: the two parts hold every character of the line but spaces and the brackets of an arrow.
      const bare = (s: string) => s.replace(/[\s()]/g, "");
      assert.equal(bare(name) + bare(amount), bare(item.name), item.name);
    }
});
