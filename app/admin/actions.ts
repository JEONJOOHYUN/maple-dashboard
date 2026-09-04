"use server";

import { cookies } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { AUCTION_HOUSE_FEE_RATE } from "@/lib/constants";
import { computeSettlement } from "@/lib/settlement-math";
import { workerTag } from "@/lib/queries";

const COOKIE_NAME = "admin_session";

export type AdminLoginState = {
  error?: string;
};

export async function adminLogin(
  _prevState: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return { error: "ADMIN_PASSWORD 환경변수가 설정되지 않았습니다." };
  }
  if (password !== expected) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }

  const store = await cookies();
  store.set(COOKIE_NAME, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return {};
}

export async function adminLogout() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  revalidatePath("/admin");
}

export async function updateLog(id: number, workerId: number, formData: FormData) {
  const logDate = String(formData.get("log_date") ?? "");
  const pureMeso = Number(formData.get("pure_meso"));
  const fragmentCount = Number(formData.get("fragment_count"));

  if (!logDate || !Number.isFinite(pureMeso) || !Number.isFinite(fragmentCount)) {
    return;
  }

  await supabase
    .from("hunting_logs")
    .update({
      log_date: logDate,
      pure_meso: pureMeso,
      fragment_count: fragmentCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/admin");
  updateTag(workerTag(workerId));
}

export async function updateSettlement(
  id: number,
  workerId: number,
  formData: FormData
) {
  const fragmentPrice = Number(formData.get("fragment_price"));
  const cashRate = Number(formData.get("cash_rate"));
  const fragmentCount = Number(formData.get("fragment_count"));
  const pureMeso = Number(formData.get("pure_meso"));
  const incentiveMeso = Number(formData.get("incentive_meso") ?? 0);

  if (
    ![fragmentPrice, cashRate, fragmentCount, pureMeso, incentiveMeso].every(
      Number.isFinite
    )
  ) {
    return;
  }

  const { feeMeso, totalMeso, krwValue } = computeSettlement(
    fragmentCount,
    pureMeso,
    fragmentPrice,
    cashRate,
    incentiveMeso
  );

  // 금액 컬럼이 모두 bigint이므로 소수점은 반올림해서 저장합니다.
  await supabase
    .from("settlements")
    .update({
      fragment_price: Math.round(fragmentPrice),
      cash_rate: Math.round(cashRate),
      fragment_count: Math.round(fragmentCount),
      pure_meso: Math.round(pureMeso),
      fee_meso: Math.round(feeMeso),
      incentive_meso: Math.round(incentiveMeso),
      total_meso: Math.round(totalMeso),
      krw_value: Math.round(krwValue),
    })
    .eq("id", id);

  revalidatePath("/admin");
  updateTag(workerTag(workerId));
}

export async function updateFragmentSale(
  id: number,
  workerId: number,
  formData: FormData
) {
  const fragmentCount = Number(formData.get("fragment_count"));
  const fragmentPrice = Number(formData.get("fragment_price"));

  if (![fragmentCount, fragmentPrice].every(Number.isFinite)) {
    return;
  }

  const grossMeso = Math.round(fragmentPrice * fragmentCount);
  const feeMeso = Math.round(grossMeso * AUCTION_HOUSE_FEE_RATE);

  await supabase
    .from("fragment_sales")
    .update({
      fragment_count: Math.round(fragmentCount),
      fragment_price: Math.round(fragmentPrice),
      gross_meso: grossMeso,
      fee_meso: feeMeso,
      net_meso: grossMeso - feeMeso,
    })
    .eq("id", id);

  revalidatePath("/admin");
  updateTag(workerTag(workerId));
}
