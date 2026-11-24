// A member's own NEXON API key, on the server: asking NEXON whose key it is, and sealing it for the database.
// The key is never logged, never sent back to the browser and never cached.
import "server-only";
import { characterWorldsOf, mainCharacter, type RawCharacterList } from "@/lib/enhance/client";
import { sealKey } from "./key-crypto";

const BASE = "https://open.api.nexon.com/maplestory/v1";
const TIMEOUT_MS = 8000;

/** badKey = wrong or revoked key · quota = the key's call limit · busy = NEXON under maintenance. */
export type KeyProblem = "badKey" | "quota" | "busy" | "failed";
export type KeyCheck = { ok: true; ouid: string; name: string; world: string } | { ok: false; problem: KeyProblem };

const PROBLEMS: Record<string, KeyProblem> = {
  OPENAPI00002: "badKey",
  OPENAPI00005: "badKey",
  OPENAPI00007: "quota",
  OPENAPI00009: "busy",
  OPENAPI00010: "busy",
  OPENAPI00011: "busy",
};

async function ask<T>(path: string, key: string): Promise<{ body: T } | { problem: KeyProblem }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}`, { headers: { "x-nxopen-api-key": key }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return { problem: "failed" };
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: { name?: string } }) | null;
  if (res.ok && body) return { body };
  return { problem: PROBLEMS[body?.error?.name ?? ""] ?? (res.status === 429 ? "quota" : "failed") };
}

/**
 * Whose key this is: NEXON's account id (the same for every key of one account) and the account's main character,
 * which names the account in the list. Two calls; the second may fail without failing the check.
 */
export async function checkNexonKey(key: string): Promise<KeyCheck> {
  const who = await ask<{ ouid?: string }>("ouid", key);
  if ("problem" in who) return { ok: false, problem: who.problem };
  const ouid = who.body.ouid;
  if (typeof ouid !== "string" || !ouid) return { ok: false, problem: "failed" };

  const list = await ask<RawCharacterList>("character/list", key);
  if ("problem" in list) return { ok: true, ouid, name: "", world: "" };
  const name = mainCharacter(list.body);
  return { ok: true, ouid, name, world: characterWorldsOf(list.body)[name] ?? "" };
}

export const sealMemberKey = (key: string, memberId: string) => sealKey(key, process.env.MAPLE_KEY_SECRET, memberId);
