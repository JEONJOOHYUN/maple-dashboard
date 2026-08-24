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
