// Browser only. One IndexedDB store of string key → value for the history days already fetched
// (too big for localStorage: two years of tries can be several MB). Falls back to memory when IndexedDB
// is blocked (private windows), so the page still works for that visit.
const DB_NAME = "maple-enhance";
const STORE = "kv";

const memory = new Map<string, unknown>();
let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  opening ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const req = work(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      })
  );
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  if (memory.has(key)) return memory.get(key) as T;
  return run<T>("readonly", (s) => s.get(key));
}

export async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await open();
  if (!db) {
    memory.set(key, value);
    return;
  }
  await run("readwrite", (s) => s.put(value, key));
}

/** Every [key, value] with lower ≤ key ≤ upper. */
export async function idbRange<T>(lower: string, upper: string): Promise<[string, T][]> {
  const db = await open();
  if (!db) return [...memory.entries()].filter(([k]) => k >= lower && k <= upper) as [string, T][];
  // One cursor in one transaction, so keys and values always belong together.
  return new Promise((resolve) => {
    const out: [string, T][] = [];
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor(IDBKeyRange.bound(lower, upper));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(out);
        out.push([String(cursor.key), cursor.value as T]);
        cursor.continue();
      };
      req.onerror = () => resolve(out);
    } catch {
      resolve(out);
    }
  });
}

/** Whether anything at all is saved here (in the store or, when it is blocked, in memory). */
export async function idbAny(): Promise<boolean> {
  if (memory.size > 0) return true;
  const db = await open();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).openKeyCursor();
      req.onsuccess = () => resolve(req.result !== null);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** Delete every key that starts with `prefix`. */
export async function idbDeletePrefix(prefix: string): Promise<void> {
  for (const k of [...memory.keys()]) if (k.startsWith(prefix)) memory.delete(k);
  await run("readwrite", (s) => s.delete(IDBKeyRange.bound(prefix, `${prefix}￿`)));
}
