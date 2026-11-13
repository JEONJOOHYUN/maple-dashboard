// NEXON Open API (MapleStory) — server only. The key is our own (NEXON_API_KEY) and never reaches the browser:
// this module is imported only from server code (app/spec/page.tsx → lib/spec/load.ts).
//
// The key is a service-stage one (user, 2026-11-13): 500 calls a second, so request starts are not spaced.
// A development-stage key (5 a second, 1,000 a day — what a local .env.local may still hold) refuses a burst: the
// first refusal drops this server instance to the spaced pace for as long as it lives (2026-11-09 measured: seven
// calls at once made some fail).

const BASE = "https://open.api.nexon.com/maplestory/v1";
const SLOW_GAP_MS = 220;
let slow = false;

export type NexonErrorKind = "noKey" | "notFound" | "quota" | "failed";

export class NexonError extends Error {
  readonly kind: NexonErrorKind;
  /** NEXON error code, e.g. OPENAPI00004 (invalid parameter / unknown identifier). */
  readonly code: string;
  constructor(kind: NexonErrorKind, message: string, code = "") {
    super(message);
    this.name = "NexonError";
    this.kind = kind;
    this.code = code;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One queue for every request start (retries included). At the spaced pace each turn waits until SLOW_GAP_MS after
// the previous *actual* start, so a delayed timer cannot release several requests at once (Codex review 2026-11-09).
// Responses still overlap.
let lastStart = 0;
let queue: Promise<void> = Promise.resolve();
function waitTurn(): Promise<void> {
  const turn = queue.then(async () => {
    if (slow) {
      const wait = lastStart + SLOW_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
    }
    lastStart = Date.now();
  });
  queue = turn;
  return turn;
}

/** GET one endpoint, e.g. nexonGet("character/basic", { ocid }). A refusal (429) is retried twice, spaced, before giving up. */
export async function nexonGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.NEXON_API_KEY;
  if (!key) throw new NexonError("noKey", "NEXON_API_KEY is not set");
  const url = `${BASE}/${path}?${new URLSearchParams(params)}`;
  for (let attempt = 0; ; attempt++) {
    await waitTurn();
    const res = await fetch(url, { headers: { "x-nxopen-api-key": key }, cache: "no-store" });
    if (res.ok) return (await res.json()) as T;
    const body = (await res.json().catch(() => null)) as { error?: { name?: string; message?: string } } | null;
    const code = body?.error?.name ?? "";
    if (res.status === 429 || code === "OPENAPI00007") {
      slow = true;
      if (attempt < 2) {
        await sleep(1100);
        continue;
      }
      throw new NexonError("quota", `${path}: ${code || res.status}`, code);
    }
    throw new NexonError("failed", `${path}: ${code || res.status} ${body?.error?.message ?? ""}`.trim(), code);
  }
}

/** Character name → ocid. Only an unknown name (400 OPENAPI00004) becomes "notFound"; outages stay "failed" (not cached). */
export async function nexonOcid(name: string): Promise<string> {
  try {
    const { ocid } = await nexonGet<{ ocid: string }>("id", { character_name: name });
    if (!ocid) throw new NexonError("notFound", name);
    return ocid;
  } catch (e) {
    if (e instanceof NexonError && e.kind === "failed" && e.code === "OPENAPI00004") throw new NexonError("notFound", name, e.code);
    throw e;
  }
}
