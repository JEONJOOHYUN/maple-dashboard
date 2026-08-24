"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

export type UpsertLogState = {
  error?: string;
  successAt?: number;
};

export async function upsertLog(
  _prevState: UpsertLogState,
  formData: FormData
): Promise<UpsertLogState> {
  const logDate = String(formData.get("log_date") ?? "");
  const pureMeso = Number(formData.get("pure_meso"));
  const fragmentCount = Number(formData.get("fragment_count"));

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

  const { error } = await supabase.from("hunting_logs").upsert(
    {
      log_date: logDate,
      pure_meso: pureMeso,
      fragment_count: fragmentCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "log_date" }
  );

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/settlement");
  return { successAt: Date.now() };
}

export async function deleteLog(id: number) {
  await supabase.from("hunting_logs").delete().eq("id", id);
  revalidatePath("/settlement");
}

export type SettleState = {
  error?: string;
  successAt?: number;
};

export async function settleUp(
  _prevState: SettleState,
  formData: FormData
): Promise<SettleState> {
  const fragmentPrice = Number(formData.get("fragment_price"));
  const cashRate = Number(formData.get("cash_rate"));
  const fragmentCount = Number(formData.get("fragment_count"));
  const pureMeso = Number(formData.get("pure_meso"));
  const feeMeso = Number(formData.get("fee_meso"));
  const totalMeso = Number(formData.get("total_meso"));
  const krwValue = Number(formData.get("krw_value"));

  const values = [
    fragmentPrice,
    cashRate,
    fragmentCount,
    pureMeso,
    feeMeso,
    totalMeso,
    krwValue,
  ];
  if (!values.every(Number.isFinite)) {
    return { error: "정산 값이 올바르지 않습니다." };
  }
  if (fragmentCount <= 0 && pureMeso <= 0) {
    return { error: "정산할 미정산 잔액이 없습니다." };
  }

  const { error } = await supabase.from("settlements").insert({
    fragment_price: fragmentPrice,
    cash_rate: cashRate,
    fragment_count: fragmentCount,
    pure_meso: pureMeso,
    fee_meso: feeMeso,
    total_meso: totalMeso,
    krw_value: krwValue,
  });

  if (error) {
    return { error: `정산 저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/settlement");
  return { successAt: Date.now() };
}

export async function deleteSettlement(id: number) {
  await supabase.from("settlements").delete().eq("id", id);
  revalidatePath("/settlement");
}
