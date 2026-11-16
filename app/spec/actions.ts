"use server";

// "다시 조회": drops one character's saved result (3 hours otherwise) so the next view asks NEXON again —
// for checking a fix right after making it. Counted per address so one visitor cannot keep the API busy.
import { updateTag } from "next/cache";
import { allowAttempt, clientIp } from "@/lib/rate-limit";
import { specTag } from "@/lib/spec/load";

const REFRESHES_PER_HOUR = 20;
const MAX_NAME = 12;

/** False when refused (bad name, over the limit, counter down): the saved result stays. */
export async function refreshSpec(name: unknown): Promise<boolean> {
  if (typeof name !== "string") return false;
  const key = name.trim();
  if (!key || key.length > MAX_NAME || /\s/.test(key)) return false;
  if (!(await allowAttempt([{ name: "spec:refresh", value: await clientIp(), max: REFRESHES_PER_HOUR, windowSeconds: 3600 }]))) return false;
  updateTag(specTag(key));
  return true;
}
