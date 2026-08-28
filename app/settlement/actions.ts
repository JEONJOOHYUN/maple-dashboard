"use server";

import { revalidatePath, updateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
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

  const { error } = await supabase.from("settlements").insert({
    worker_id: workerId,
    fragment_price: fragmentPrice,
    cash_rate: cashRate,
    fragment_count: fragmentCount,
    pure_meso: pureMeso,
    fee_meso: feeMeso,
    incentive_meso: incentiveMeso,
    total_meso: totalMeso,
    krw_value: krwValue,
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
