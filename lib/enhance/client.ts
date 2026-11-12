// Browser only. NEXON Open API called straight from the visitor's browser with the visitor's own key:
// the history ("확률 정보") endpoints only return the key owner's account, and the key must not reach our server
// (handoff 2026-11-11). CORS: open.api.nexon.com answers preflights for x-nxopen-api-key (checked 2026-11-12).
//
// A developer-stage key allows 5 calls per second and 1,000 per day, so request starts are spaced out.
import type { FoundItem } from "./items.ts";

const BASE = "https://open.api.nexon.com/maplestory/v1";
const GAP_MS = 230;

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

export function createApi(key: string): Api {
  // One line for every request start (retries too), so a burst can never pass 5 per second.
  let last = 0;
  let line: Promise<void> = Promise.resolve();
  const turn = () => {
    const mine = line.then(async () => {
      const wait = last + GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
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

export type RawCharacterList = { account_list?: { character_list?: { character_name?: string; character_level?: number }[] }[] };

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

/** Short id for one key (one NEXON account) so records of different keys never mix. Not reversible. */
export async function accountId(key: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`maple-enhance:${key}`));
  return [...new Uint8Array(hash).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
