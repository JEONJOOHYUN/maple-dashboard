"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

export type AddWorkerState = {
  error?: string;
  successAt?: number;
};

export async function addWorker(
  _prevState: AddWorkerState,
  formData: FormData
): Promise<AddWorkerState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "이름을 입력해주세요." };
  }

  const { count } = await supabase
    .from("workers")
    .select("id", { count: "exact", head: true });

  const { error } = await supabase.from("workers").insert({
    name,
    sort_order: count ?? 0,
  });

  if (error) {
    return { error: `추가에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/settlement");
  revalidatePath("/admin");
  return { successAt: Date.now() };
}

export async function renameWorker(id: number, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("workers").update({ name }).eq("id", id);
  revalidatePath("/settlement");
  revalidatePath("/admin");
}

export async function deleteWorker(id: number) {
  await supabase.from("workers").delete().eq("id", id);
  revalidatePath("/settlement");
  revalidatePath("/admin");
}
