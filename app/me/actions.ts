"use server";

import { cookies } from "next/headers";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { ouidHash } from "@/lib/auth/key-crypto";
import { checkNexonKey, sealMemberKey, type KeyProblem } from "@/lib/auth/nexon-key";
import { MAX_NEXON_ACCOUNTS, isKeyShape, packLabel } from "@/lib/auth/rules";
import { clearHintCookie, getMember, sessionClient } from "@/lib/auth/server";
import { homeworkTag } from "@/lib/homework/server";
import { allowAttempt, clientIp } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** What a form of 내 정보 shows after it was sent: one line, an error or what was done. */
export type FormState = { error?: string; done?: string };

const PROBLEMS: Record<KeyProblem, string> = {
  badKey: "API 키가 올바르지 않음",
  quota: "이 키의 호출 한도 초과 → 잠시 뒤 다시",
  busy: "넥슨 API 점검 중 → 잠시 뒤 다시",
  failed: "넥슨 서버 연결 실패 → 잠시 뒤 다시",
};
const NOT_SAVED = "저장 실패 → 잠시 뒤 다시";
const TOO_MANY = `넥슨 계정은 ${MAX_NEXON_ACCOUNTS}개까지`;

/** The row id a form carries (a positive whole number), or null. */
function rowId(value: FormDataEntryValue | null): number | null {
  return typeof value === "string" && /^[1-9]\d{0,15}$/.test(value) ? Number(value) : null;
}

/**
 * Saves a NEXON API key for the signed-in member. NEXON is asked whose key it is: a key of an account already
 * connected replaces the key kept for it, any other becomes a new account. With `row` (the "키 교체" of one
 * account) the key has to belong to that very account.
 *
 * Rows are written with the service role key (members have no write grant), so every query here names the member.
 */
export async function saveKey(_prev: FormState, form: FormData): Promise<FormState> {
  const member = await getMember();
  if (!member) redirect("/login?next=/me");

  const raw = form.get("key");
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key) return { error: "API 키 먼저 붙여 넣기" };
  if (!isKeyShape(key)) return { error: "API 키 형식이 아님 → 다시 복사해 붙여 넣기" };

  // Each try costs NEXON two calls and tells whether a key is real: counted per member and per address.
  const allowed = await allowAttempt([
    { name: "key:member", value: member.id, max: 10, windowSeconds: 600 },
    { name: "key:ip", value: await clientIp(), max: 30, windowSeconds: 600 },
  ]);
  if (!allowed) return { error: "시도가 너무 많음 → 10분 뒤 다시" };

  const check = await checkNexonKey(key);
  if (!check.ok) return { error: PROBLEMS[check.problem] };

  const hash = ouidHash(check.ouid);
  const db = supabaseAdmin();
  const found = await db.from("nexon_accounts").select("id, user_id").eq("ouid_hash", hash).maybeSingle();
  if (found.error) return { error: NOT_SAVED };
  if (found.data && found.data.user_id !== member.id) return { error: "다른 계정에 이미 등록된 넥슨 계정" };

  const row = rowId(form.get("row"));
  if (row !== null && found.data?.id !== row) return { error: "이 넥슨 계정의 키가 아님 → 아래 칸에 새로 등록" };

  const values = { key_cipher: sealMemberKey(key, member.id), label: packLabel(check.name, check.world) };
  if (found.data) {
    const updated = await db
      .from("nexon_accounts")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", found.data.id)
      .eq("user_id", member.id);
    if (updated.error) return { error: NOT_SAVED };
    refresh();
    return { done: "키 교체됨" };
  }

  const count = await db.from("nexon_accounts").select("id", { count: "exact", head: true }).eq("user_id", member.id);
  if (count.error) return { error: NOT_SAVED };
  if ((count.count ?? 0) >= MAX_NEXON_ACCOUNTS) return { error: TOO_MANY };

  const inserted = await db.from("nexon_accounts").insert({ ...values, user_id: member.id, ouid_hash: hash }).select("id").single();
  // 23505: the same account was saved in between (another tab, or another member): nothing was written.
  if (inserted.error) return { error: inserted.error.code === "23505" ? "이미 등록된 넥슨 계정 → 새로 고침" : NOT_SAVED };

  // Two keys sent at the same moment both pass the count above: counted again with the new row in, and a row
  // that went over the limit is taken back out (if the count cannot be read, too).
  const after = await db.from("nexon_accounts").select("id", { count: "exact", head: true }).eq("user_id", member.id);
  if (after.error || (after.count ?? 0) > MAX_NEXON_ACCOUNTS) {
    await db.from("nexon_accounts").delete().eq("id", inserted.data.id).eq("user_id", member.id);
    return { error: after.error ? NOT_SAVED : TOO_MANY };
  }
  refresh();
  return { done: "등록됨" };
}

/** Deletes one connected NEXON account of the member (the sealed key goes with the row). */
export async function removeKey(_prev: FormState, form: FormData): Promise<FormState> {
  const member = await getMember();
  if (!member) redirect("/login?next=/me");
  const row = rowId(form.get("row"));
  if (row === null) return { error: "삭제 실패 → 새로 고침" };
  const gone = await supabaseAdmin().from("nexon_accounts").delete().eq("id", row).eq("user_id", member.id);
  if (gone.error) return { error: "삭제 실패 → 잠시 뒤 다시" };
  // What NEXON said for that account is not shown again (lib/homework/server.ts keeps it for a few minutes).
  updateTag(homeworkTag(member.id));
  refresh();
  return { done: "삭제됨" };
}

/** Deletes the member's account. The connected NEXON accounts go with it (on delete cascade, migration 007). */
export async function leave(): Promise<FormState> {
  const member = await getMember();
  if (!member) redirect("/login");
  const gone = await supabaseAdmin().auth.admin.deleteUser(member.id);
  if (gone.error) return { error: "탈퇴 실패 → 잠시 뒤 다시" };
  updateTag(homeworkTag(member.id));

  // The account is gone, so the auth server may refuse the sign-out: the session cookies are dropped either way.
  const supabase = await sessionClient();
  const out = await supabase.auth.signOut({ scope: "local" });
  if (out.error) {
    const store = await cookies();
    for (const c of store.getAll()) if (c.name.startsWith("sb-")) store.delete(c.name);
  }
  await clearHintCookie();
  redirect("/");
}
