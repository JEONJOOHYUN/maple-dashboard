"use server";

import { cookies } from "next/headers";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/auth/server";
import { PICK_COOKIE, cleanPick, packPick } from "@/lib/homework/pick";
import { homeworkTag, memberCharacters, pickedHere, type PickData } from "@/lib/homework/server";
import { allowAttempt } from "@/lib/rate-limit";
import { MAX_PICKED } from "@/lib/revenue/data";

export type RefreshState = { error?: string };

/** Where the pick cookie lives: only this page and its actions ever get it. */
const PICK_PATH = "/homework";

async function member() {
  const found = await getMember();
  if (!found) redirect("/login?next=/homework");
  return found;
}

/**
 * Asks NEXON again instead of showing the answer kept for five minutes. Every refresh spends the member's own call
 * allowance (a call per character), so it is counted per member.
 */
export async function refreshHomework(): Promise<RefreshState> {
  const { id } = await member();
  const allowed = await allowAttempt([{ name: "homework:refresh", value: id, max: 10, windowSeconds: 600 }]);
  if (!allowed) return { error: "새로 고침이 너무 잦음 → 잠시 뒤 다시" };
  updateTag(homeworkTag(id));
  refresh();
  return {};
}

/** Every character of the member's accounts, for the picker. null = they could not be read. */
export async function loadCharacters(): Promise<PickData | null> {
  const { id } = await member();
  return memberCharacters(id, await pickedHere());
}

/**
 * Keeps the characters the member picked, in this browser. Nothing picked = back to the automatic choice. The ids
 * are only checked for their shape here: the page shows a picked character only when it is on one of the member's
 * own lists.
 */
export async function saveCharacters(ocids: string[]): Promise<void> {
  await member();
  const picked = cleanPick(ocids, MAX_PICKED);
  const store = await cookies();
  if (picked.length === 0) store.delete({ name: PICK_COOKIE, path: PICK_PATH });
  else store.set(PICK_COOKIE, packPick(picked), { path: PICK_PATH, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 400 });
  refresh();
}
