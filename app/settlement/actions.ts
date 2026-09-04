"use server";

import { revalidatePath, updateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { AUCTION_HOUSE_FEE_RATE } from "@/lib/constants";
import { workerTag } from "@/lib/queries";

export type UpsertLogState = {
  error?: string;
  successAt?: number;
};

export async function upsertLog(
  _prevState: UpsertLogState,
  formData: FormData
): Promise<UpsertLogState> {
  const workerId = Number(formData.get("worker_id"));
  const logDate = String(formData.get("log_date") ?? "");
  const pureMeso = Number(formData.get("pure_meso"));
  const fragmentCount = Number(formData.get("fragment_count"));
  const mode = formData.get("mode") === "overwrite" ? "overwrite" : "add";

  if (!Number.isFinite(workerId) || workerId <= 0) {
    return { error: "부주를 선택해주세요." };
  }
  if (!logDate) {
    return { error: "날짜를 입력해주세요." };
  }
  if (!Number.isFinite(pureMeso) || pureMeso < 0) {
    return { error: "순수 메소는 0 이상의 숫자여야 합니다." };
  }
  if (
    !Number.isFinite(fragmentCount) ||
    fragmentCount < 0 ||
    !Number.isInteger(fragmentCount)
  ) {
    return { error: "솔 에르다 조각 개수는 0 이상의 정수여야 합니다." };
  }

  let finalPureMeso = pureMeso;
  let finalFragmentCount = fragmentCount;

  if (mode === "add") {
    // 하루를 끊어서 여러 번 사냥할 수 있으므로, 기본은 기존 기록에 더합니다.
    const { data: existing } = await supabase
      .from("hunting_logs")
      .select("pure_meso, fragment_count")
      .eq("worker_id", workerId)
      .eq("log_date", logDate)
      .maybeSingle();

    if (existing) {
      finalPureMeso = existing.pure_meso + pureMeso;
      finalFragmentCount = existing.fragment_count + fragmentCount;
    }
  }

  const { error } = await supabase.from("hunting_logs").upsert(
    {
      worker_id: workerId,
      log_date: logDate,
      pure_meso: finalPureMeso,
      fragment_count: finalFragmentCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "worker_id,log_date" }
  );

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  updateTag(workerTag(workerId));
  revalidatePath("/admin");
  return { successAt: Date.now() };
}

export async function deleteLog(id: number, workerId: number) {
  await supabase.from("hunting_logs").delete().eq("id", id);
  updateTag(workerTag(workerId));
  revalidatePath("/admin");
}

export type SellFragmentsState = {
  error?: string;
  successAt?: number;
};

/**
 * 조각을 경매장 시세로 팔아 메소로 전환합니다.
 * 판매한 조각만큼 누적 조각이 줄고, 수수료를 뗀 실수령 메소가 누적 메소에 더해집니다.
 * (현금 정산은 settleUp이 따로 담당합니다.)
 */
export async function sellFragments(
  _prevState: SellFragmentsState,
  formData: FormData
): Promise<SellFragmentsState> {
  const workerId = Number(formData.get("worker_id"));
  const fragmentCount = Number(formData.get("fragment_count"));
  const fragmentPrice = Number(formData.get("fragment_price"));

  if (!Number.isFinite(workerId) || workerId <= 0) {
    return { error: "부주를 선택해주세요." };
  }
  if (!Number.isFinite(fragmentCount) || fragmentCount <= 0) {
    return { error: "판매할 조각 개수를 입력해주세요." };
  }
  if (!Number.isFinite(fragmentPrice) || fragmentPrice <= 0) {
    return { error: "조각 가격을 입력해주세요." };
  }

  const grossMeso = Math.round(fragmentPrice * fragmentCount);
  const feeMeso = Math.round(grossMeso * AUCTION_HOUSE_FEE_RATE);
  const netMeso = grossMeso - feeMeso;

  const { error } = await supabase.from("fragment_sales").insert({
    worker_id: workerId,
    fragment_count: Math.round(fragmentCount),
    fragment_price: Math.round(fragmentPrice),
    gross_meso: grossMeso,
    fee_meso: feeMeso,
    net_meso: netMeso,
  });

  if (error) {
    return { error: `판매 저장에 실패했습니다: ${error.message}` };
  }

  updateTag(workerTag(workerId));
  revalidatePath("/admin");
  return { successAt: Date.now() };
}

export async function deleteFragmentSale(id: number, workerId: number) {
  await supabase.from("fragment_sales").delete().eq("id", id);
  updateTag(workerTag(workerId));
  revalidatePath("/admin");
}

export type SettleState = {
  error?: string;
  successAt?: number;
};

export async function settleUp(
  _prevState: SettleState,
  formData: FormData
): Promise<SettleState> {
  const workerId = Number(formData.get("worker_id"));
  const fragmentPrice = Number(formData.get("fragment_price"));
  const cashRate = Number(formData.get("cash_rate"));
  const fragmentCount = Number(formData.get("fragment_count"));
  const pureMeso = Number(formData.get("pure_meso"));
  const feeMeso = Number(formData.get("fee_meso"));
  const incentiveMeso = Number(formData.get("incentive_meso") ?? 0);
  const totalMeso = Number(formData.get("total_meso"));
  const krwValue = Number(formData.get("krw_value"));

  const values = [
    fragmentPrice,
    cashRate,
    fragmentCount,
    pureMeso,
    feeMeso,
    incentiveMeso,
    totalMeso,
    krwValue,
  ];
  if (!Number.isFinite(workerId) || workerId <= 0) {
    return { error: "부주를 선택해주세요." };
  }
  if (!values.every(Number.isFinite)) {
    return { error: "정산 값이 올바르지 않습니다." };
  }
  if (incentiveMeso < 0) {
    return { error: "인센티브 메소는 0 이상이어야 합니다." };
  }
  if (fragmentCount <= 0 && pureMeso <= 0 && incentiveMeso <= 0) {
    return { error: "정산할 미정산 잔액이 없습니다." };
  }

  // 모든 금액 컬럼이 bigint라 소수점이 있으면 저장에 실패하므로 반올림합니다.
  const { error } = await supabase.from("settlements").insert({
    worker_id: workerId,
    fragment_price: Math.round(fragmentPrice),
    cash_rate: Math.round(cashRate),
    fragment_count: Math.round(fragmentCount),
    pure_meso: Math.round(pureMeso),
    fee_meso: Math.round(feeMeso),
    incentive_meso: Math.round(incentiveMeso),
    total_meso: Math.round(totalMeso),
    krw_value: Math.round(krwValue),
  });

  if (error) {
    return { error: `정산 저장에 실패했습니다: ${error.message}` };
  }

  updateTag(workerTag(workerId));
  revalidatePath("/admin");
  return { successAt: Date.now() };
}

export async function deleteSettlement(id: number, workerId: number) {
  await supabase.from("settlements").delete().eq("id", id);
  updateTag(workerTag(workerId));
  revalidatePath("/admin");
}
