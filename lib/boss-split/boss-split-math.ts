// 보스 분배금 계산 로직.
//
// 파티장(항상 첫 번째 구성원)이 아이템을 판매해 실수령액을 받고, 다른
// 파티원에게는 그 몫을 다시 거래(경매장 재등록 등)로 보내야 하므로
// 그 몫에는 수수료가 한 번 더 붙는다고 가정합니다. 그래서 목표 분배
// 비율(ratio)대로 "최종 분배금"이 나오게 하려면, 실제로 실수령액에서
// 떼어내는 금액(before)은 파티원마다 다르게 역산해야 합니다.
//
// 타 서버 파티원: 파티장이 메소마켓에서 메소를 메이플포인트로 바꿔(수수료 1%, 파는 쪽 = 파티장이 냄) 그 서버로
// 가져가 다시 메소로 바꾼 뒤 건네야 합니다. 그래서 그 사람 몫에는 메소마켓 수수료가 한 번 더 붙습니다.
// 수수료는 다른 수수료와 마찬가지로 모두가 비율대로 나눠 부담합니다(최종 분배금이 비율대로 나오게).
export const MESO_MARKET_FEE_RATE = 0.01;

export type SplitShare = {
  ratio: number; // 0~1, 전체 합이 1이어야 함
  beforeMeso: number; // 이 사람 몫으로 실수령액에서 떼어낸 금액 (수수료 적용 전, 타 서버면 메소마켓에 팔 금액)
  handedMeso: number; // 그 사람에게 실제로 건네는 금액 (받는 사람이 다시 낼 수수료 포함). 같은 서버면 beforeMeso 와 같음
  finalMeso: number; // 실제로 받는 최종 분배금
  deduction: number; // beforeMeso - finalMeso
};

export function computeBossSplit(
  netMeso: number,
  ratios: number[],
  transferFeeRate: number,
  /** 구성원별 타 서버 여부 (파티장 = 첫 번째는 무시). 없으면 모두 같은 서버. */
  otherServer: boolean[] = []
): SplitShare[] {
  if (ratios.length === 0 || netMeso <= 0) {
    return ratios.map((ratio) => ({ ratio, beforeMeso: 0, handedMeso: 0, finalMeso: 0, deduction: 0 }));
  }

  // 그 사람 몫에서 수수료를 내고 남는 비율: 받는 사람이 다시 내는 수수료 × (타 서버면) 메소마켓 수수료.
  const handKeep = 1 - transferFeeRate;
  const keep = ratios.map((_, index) => (index === 0 ? 1 : handKeep * (otherServer[index] ? 1 - MESO_MARKET_FEE_RATE : 1)));
  const denominator = ratios.reduce((sum, ratio, index) => sum + ratio / keep[index], 0);
  const scale = denominator > 0 ? netMeso / denominator : 0;

  return ratios.map((ratio, index) => {
    const finalMeso = ratio * scale;
    const beforeMeso = finalMeso / keep[index];
    return {
      ratio,
      beforeMeso,
      handedMeso: index === 0 ? finalMeso : finalMeso / handKeep,
      finalMeso,
      deduction: beforeMeso - finalMeso,
    };
  });
}
