// A member's own NEXON API key, on the server: asking NEXON whose key it is, and sealing it for the database.
// The key is never logged, never sent back to the browser and never cached.
import "server-only";
import { characterWorldsOf, mainCharacter, type RawCharacterList } from "@/lib/enhance/client";
import { BASE, CODE_KINDS, KEY_HEADER } from "@/lib/nexon/open-api";
import { sealKey } from "./key-crypto";

const TIMEOUT_MS = 8000;

/** badKey = wrong or revoked key · quota = the key's call limit · busy = NEXON under maintenance. */
export type KeyProblem = "badKey" | "quota" | "busy" | "failed";
export type KeyCheck = { ok: true; ouid: string; name: string; world: string } | { ok: false; problem: KeyProblem };

/** One call to NEXON with a member's key (never cached by the fetch layer: the key is in its header). */
/** `code` = NEXON's own error code when it gave one (OPENAPI00009 …). */
export async function ask<T>(path: string, key: string, params?: Record<string, string>): Promise<{ body: T } | { problem: KeyProblem; code?: string }> {
  let res: Response;
  try {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    res = await fetch(`${BASE}/${path}${query}`, { headers: { [KEY_HEADER]: key }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return { problem: "failed" };
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: { name?: string } }) | null;
  if (res.ok && body) return { body };
  // A value NEXON does not take ("param") is not the member's to fix: it is a failure here.
  const code = body?.error?.name ?? "";
  const kind = CODE_KINDS[code];
  return { problem: kind && kind !== "param" ? kind : res.status === 429 ? "quota" : "failed", code };
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
