// 보스 분배금 계산 로직.
//
// 파티장(항상 첫 번째 구성원)이 아이템을 판매해 실수령액을 받고, 다른
// 파티원에게는 그 몫을 다시 거래(경매장 재등록 등)로 보내야 하므로
// 그 몫에는 수수료가 한 번 더 붙는다고 가정합니다. 그래서 목표 분배
// 비율(ratio)대로 "최종 분배금"이 나오게 하려면, 실제로 실수령액에서
// 떼어내는 금액(before)은 파티원마다 다르게 역산해야 합니다.
export type SplitShare = {
  ratio: number; // 0~1, 전체 합이 1이어야 함
  beforeMeso: number; // 이 사람 몫으로 실수령액에서 떼어낸 금액 (수수료 적용 전)
  finalMeso: number; // 실제로 받는 최종 분배금
  deduction: number; // beforeMeso - finalMeso
};

export function computeBossSplit(
  netMeso: number,
  ratios: number[],
  transferFeeRate: number
): SplitShare[] {
  if (ratios.length === 0 || netMeso <= 0) {
    return ratios.map((ratio) => ({ ratio, beforeMeso: 0, finalMeso: 0, deduction: 0 }));
  }

  const [leaderRatio, ...otherRatios] = ratios;
  const otherRatioSum = otherRatios.reduce((sum, r) => sum + r, 0);
  const denominator = leaderRatio + otherRatioSum / (1 - transferFeeRate);
  const scale = denominator > 0 ? netMeso / denominator : 0;

  return ratios.map((ratio, index) => {
    const finalMeso = ratio * scale;
    const beforeMeso = index === 0 ? finalMeso : finalMeso / (1 - transferFeeRate);
    return {
      ratio,
      beforeMeso,
      finalMeso,
      deduction: beforeMeso - finalMeso,
    };
  });
}
