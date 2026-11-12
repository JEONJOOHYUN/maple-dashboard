// Browser only. NEXON Open API called straight from the visitor's browser with the visitor's own key:
// the history ("확률 정보") endpoints only return the key owner's account, and the key must not reach our server
// (handoff 2026-11-11). CORS: open.api.nexon.com answers preflights for x-nxopen-api-key (checked 2026-11-12).
//
// Visitors are told to register a service-stage application (500 calls per second, 20,000,000 per day), so calls
// start close together. A development-stage key allows 5 per second and 1,000 per day: the first "too many requests"
// answer drops this key to that pace, and the browser remembers it for the key.
import type { FoundItem } from "./items.ts";

const BASE = "https://open.api.nexon.com/maplestory/v1";
/** Service stage: at most this many request starts in any one second, half of the 500 allowed (the allowance is per application). */
const FAST_PER_SECOND = 250;
/** A refusal while this few requests were started in the last second can only be a development-stage key. */
const SURELY_DEV = 100;
/** Development stage: under 5 request starts a second. */
const SLOW_GAP_MS = 230;

const paceKey = (account: string) => `enhance:pace:${account}`;
function knownSlow(account: string | undefined): boolean {
  try {
    return !!account && localStorage.getItem(paceKey(account)) === "slow";
  } catch {
    return false;
  }
}
function rememberSlow(account: string | undefined) {
  try {
    if (account) localStorage.setItem(paceKey(account), "slow");
  } catch {
    // Storage blocked: the key is simply tried fast again next visit.
  }
}
/** Forget the pace remembered for a key (when the key and its records are deleted). */
export function forgetPace(account: string) {
  try {
    localStorage.removeItem(paceKey(account));
  } catch {
    // nothing to forget
  }
}

/** badKey = wrong or revoked key · quota = call limit · param = date outside what the API keeps · busy = maintenance. */
export type ApiErrorKind = "badKey" | "quota" | "param" | "busy" | "network" | "failed";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly code: string;
  constructor(kind: ApiErrorKind, code = "") {
    super(`${kind} ${code}`.trim());
    this.name = "ApiError";
    this.kind = kind;
    this.code = code;
  }
}

const KINDS: Record<string, ApiErrorKind> = {
  OPENAPI00002: "badKey",
  OPENAPI00003: "param",
  OPENAPI00004: "param",
  OPENAPI00005: "badKey",
  OPENAPI00007: "quota",
  OPENAPI00009: "busy",
  OPENAPI00010: "busy",
  OPENAPI00011: "busy",
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });

export type Api = { get<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> };

/** `account` = the key's id: with it the pace found for this key is remembered across visits. */
export function createApi(key: string, account?: string): Api {
  let slow = knownSlow(account);
  // One line for every request start (retries too), so a burst can never pass the pace of the key's stage.
  let last = 0;
  /** When the requests of the last second or so were started. */
  let started: number[] = [];
  let line: Promise<void> = Promise.resolve();
  const turn = () => {
    const mine = line.then(async () => {
      if (slow) {
        const wait = last + SLOW_GAP_MS - Date.now();
        if (wait > 0) await sleep(wait);
      }
      // Counted over the last second rather than spaced by a few ms each: timers are too coarse for that.
      for (;;) {
        const now = Date.now();
        started = started.filter((t) => now - t < 1000);
        if (started.length < FAST_PER_SECOND) break;
        await sleep(started[0] + 1001 - now);
      }
      last = Date.now();
      started.push(last);
    });
    line = mine;
    return mine;
  };

  return {
    async get<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
      const url = `${BASE}/${path}?${new URLSearchParams(params)}`;
      for (let attempt = 0; ; attempt++) {
        await turn();
        signal?.throwIfAborted();
        let res: Response;
        try {
          res = await fetch(url, { headers: { "x-nxopen-api-key": key }, cache: "no-store", signal });
        } catch (e) {
          if (signal?.aborted) throw e;
          throw new ApiError("network");
        }
        if (res.ok) return (await res.json()) as T;
        const body = (await res.json().catch(() => null)) as { error?: { name?: string } } | null;
        const code = body?.error?.name ?? "";
        const kind = KINDS[code] ?? (res.status === 429 ? "quota" : "failed");
        // Refused: from here on the development-stage pace. It is remembered for the key only when it cannot have
        // been a service-stage key going over 500 a second (another tab fetching with the same key).
        if (kind === "quota" && !slow) {
          slow = true;
          const now = Date.now();
          if (started.filter((t) => now - t < 1000).length <= SURELY_DEV) rememberSlow(account);
        }
        // The per-second limit clears in a second (another tab may be calling too); the daily one does not,
        // so wait and try twice more before giving up.
        if (kind === "quota" && attempt < 2) {
          await sleep(1200 * (attempt + 1), signal);
          continue;
        }
        throw new ApiError(kind, code);
      }
    },
  };
}

/**
 * Every row of one KST day from a history endpoint ("history/starforce" → "starforce_history" …).
 * More than 1,000 a day comes in pages (the cursor stays inside the day).
 */
export async function fetchHistoryDay<T>(api: Api, path: string, listKey: string, date: string, signal?: AbortSignal): Promise<T[]> {
  const out: T[] = [];
  let cursor = "";
  for (let page = 0; page < 100; page++) {
    const body = await api.get<Record<string, unknown>>(path, cursor ? { count: "1000", cursor } : { count: "1000", date }, signal);
    const list = body[listKey];
    if (Array.isArray(list)) out.push(...(list as T[]));
    cursor = typeof body.next_cursor === "string" ? body.next_cursor : "";
    if (!cursor) break;
  }
  return out;
}

type RawEquip = { item_name?: string; item_icon?: string; item_equipment_part?: string; item_base_option?: { base_equipment_level?: number } };
type RawEquipment = Record<string, unknown>;
const EQUIP_LISTS = ["item_equipment", "item_equipment_preset_1", "item_equipment_preset_2", "item_equipment_preset_3", "dragon_equipment", "mechanic_equipment"];

/** Level, icon and slot of everything a character wears (all presets), by item name. Two calls. */
export async function fetchEquipment(api: Api, character: string, signal?: AbortSignal): Promise<Record<string, FoundItem>> {
  const { ocid } = await api.get<{ ocid?: string }>("id", { character_name: character }, signal);
  if (!ocid) return {};
  const raw = await api.get<RawEquipment>("character/item-equipment", { ocid }, signal);
  const out: Record<string, FoundItem> = {};
  for (const list of EQUIP_LISTS) {
    const items = raw[list];
    if (!Array.isArray(items)) continue;
    for (const it of items as RawEquip[]) {
      const level = it.item_base_option?.base_equipment_level;
      if (!it.item_name || typeof level !== "number" || level <= 0) continue;
      // Icons are only ever shown from NEXON's own host.
      const icon = typeof it.item_icon === "string" && it.item_icon.startsWith("https://open.api.nexon.com/") ? it.item_icon : "";
      out[it.item_name] = { level, icon, part: it.item_equipment_part ?? "" };
    }
  }
  return out;
}

export type RawCharacterList = { account_list?: { character_list?: { ocid?: string; character_name?: string; world_name?: string; character_class?: string; character_level?: number }[] }[] };

/** The highest-level character of the account (the first one on a tie), "" when there is none. */
export function mainCharacter(body: RawCharacterList): string {
  let name = "";
  let level = -1;
  for (const account of body.account_list ?? [])
    for (const c of account.character_list ?? []) {
      const lv = typeof c.character_level === "number" ? c.character_level : 0;
      if (c.character_name && lv > level) {
        name = c.character_name;
        level = lv;
      }
    }
  return name;
}

/** What a remembered key is called in the list: the account's main character. One call (checked 2026-11-12: 66 characters in one answer). */
export async function fetchMainCharacter(api: Api, signal?: AbortSignal): Promise<string> {
  return mainCharacter(await api.get<RawCharacterList>("character/list", {}, signal));
}

/** Character → the world it is in today. */
export function characterWorldsOf(body: RawCharacterList): Record<string, string> {
  const out: Record<string, string> = {};
  for (const account of body.account_list ?? []) for (const c of account.character_list ?? []) if (c.character_name && c.world_name) out[c.character_name] = c.world_name;
  return out;
}

/** Character → its job (e.g. "제논"). */
export function characterClassesOf(body: RawCharacterList): Record<string, string> {
  const out: Record<string, string> = {};
  for (const account of body.account_list ?? []) for (const c of account.character_list ?? []) if (c.character_name && c.character_class) out[c.character_name] = c.character_class;
  return out;
}

/** Character → its id for the per-character endpoints. */
export function characterIdsOf(body: RawCharacterList): Record<string, string> {
  const out: Record<string, string> = {};
  for (const account of body.account_list ?? []) for (const c of account.character_list ?? []) if (c.character_name && c.ocid) out[c.character_name] = c.ocid;
  return out;
}

/** The account's characters: where each is today and its id. One call (the same answer as fetchMainCharacter's). */
export async function fetchCharacters(api: Api, signal?: AbortSignal): Promise<{ worlds: Record<string, string>; ocids: Record<string, string>; classes: Record<string, string> }> {
  const body = await api.get<RawCharacterList>("character/list", {}, signal);
  return { worlds: characterWorldsOf(body), ocids: characterIdsOf(body), classes: characterClassesOf(body) };
}

/** 통찰력 level of one character (0 when it has none yet). One call. */
export async function fetchInsight(api: Api, ocid: string, signal?: AbortSignal): Promise<number> {
  const body = await api.get<{ insight_level?: number | null }>("character/propensity", { ocid }, signal);
  return typeof body.insight_level === "number" ? body.insight_level : 0;
}

/** Short id for one key (one NEXON account) so records of different keys never mix. Not reversible. */
export async function accountId(key: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`maple-enhance:${key}`));
  return [...new Uint8Array(hash).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
