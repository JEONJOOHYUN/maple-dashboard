"use server";

import { updateTag } from "next/cache";
import { getMember } from "@/lib/auth/server";
import { cleanPick } from "@/lib/homework/pick";
import { homeworkTag } from "@/lib/homework/server";
import { allowAttempt } from "@/lib/rate-limit";
import { MAX_ASKED } from "@/lib/revenue/data";
import { memberFaces, memberRevenue, memberSchedulers, saveSettings, type MemberRevenue, type States } from "@/lib/revenue/server";
import { cleanPatch, isEmptyPatch } from "@/lib/revenue/settings";

// The boss revenue page is public and static: a visitor without a session never calls these, and a call without
// one is answered "guest" (nothing is redirected: the page goes on with the keys kept in the browser).
// The browser sends one call at a time, so each takes a whole batch (every character at once).

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** What the page opens with for a member. failed = the accounts or settings could not be read. */
export async function openRevenue(): Promise<MemberRevenue | "guest" | "failed"> {
  const member = await getMember();
  if (!member) return "guest";
  return (await memberRevenue(member.id)) ?? "failed";
}

/** This week's schedulers of the member's characters, or with `date` those of the last day of last week. */
export async function readSchedulers(ocids: string[], date?: string): Promise<States | "guest" | "failed"> {
  const member = await getMember();
  if (!member) return "guest";
  if (date !== undefined && (typeof date !== "string" || !DATE.test(date))) return "failed";
  return (await memberSchedulers(member.id, cleanPick(ocids, MAX_ASKED), date)) ?? "failed";
}

/** Look pictures of the member's characters, by id. */
export async function readFaces(ocids: string[]): Promise<Record<string, string>> {
  const member = await getMember();
  if (!member) return {};
  return (await memberFaces(member.id, cleanPick(ocids, MAX_ASKED))) ?? {};
}

/**
 * Drops what NEXON said for the member (kept a few minutes, shared with the homework page), so the calls after
 * this one ask again. Every such round spends the member's own call allowance, so it is counted.
 */
export async function refreshRevenue(): Promise<"ok" | "limited" | "guest"> {
  const member = await getMember();
  if (!member) return "guest";
  const allowed = await allowAttempt([{ name: "revenue:refresh", value: member.id, max: 10, windowSeconds: 600 }]);
  if (!allowed) return "limited";
  updateTag(homeworkTag(member.id));
  return "ok";
}

/** Merges what the member changed (lib/revenue/settings.ts `Patch`) into the settings kept with the account. */
export async function saveRevenueSettings(patch: unknown): Promise<"ok" | "guest" | "failed"> {
  const member = await getMember();
  if (!member) return "guest";
  const cleaned = cleanPatch(patch);
  if (!cleaned) return "failed";
  if (isEmptyPatch(cleaned)) return "ok";
  // The page sends changes together about once a second at most; far above that is not a person.
  const allowed = await allowAttempt([{ name: "revenue:save", value: member.id, max: 300, windowSeconds: 600 }]);
  if (!allowed) return "failed";
  return (await saveSettings(member.id, cleaned)) ? "ok" : "failed";
}
