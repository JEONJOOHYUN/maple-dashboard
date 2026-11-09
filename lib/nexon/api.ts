// NEXON Open API (MapleStory) — server only. The key is our own (NEXON_API_KEY) and never reaches the browser:
// this module is imported only from server code (app/spec/page.tsx → lib/spec/load.ts).
//
// Dev key limits (2026-11-09 measured): 5 calls per second, 1,000 per day. Firing 7 calls at once made some fail,
// so calls run one after another with a gap between starts. The gap is per server instance only.

const BASE = "https://open.api.nexon.com/maplestory/v1";
const GAP_MS = 220;

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

// One queue for every request start (retries included): each turn waits until GAP_MS after the previous *actual*
// start, so a delayed timer cannot release several requests at once (Codex review 2026-11-09). Responses still overlap.
let lastStart = 0;
let queue: Promise<void> = Promise.resolve();
function waitTurn(): Promise<void> {
  const turn = queue.then(async () => {
    const wait = lastStart + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
  });
  queue = turn;
  return turn;
}

/** GET one endpoint, e.g. nexonGet("character/basic", { ocid }). Retries once on 429 before giving up. */
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
      if (attempt === 0) {
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
