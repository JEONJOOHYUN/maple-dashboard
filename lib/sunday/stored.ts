// Pure rules for the sunday_weeks table (supabase/migrations/006_add_sunday_weeks.sql): when the Cron saves a
// reading, and how stored weeks join the bundled history. No I/O here so the rules are testable.
import { toWeek, type SundayWeek } from "./history.ts";
import type { HistoryItem } from "./bundles.ts";

export type StoredStatus = "auto" | "review" | "confirmed";

/** A published row as the site reads it (status auto or confirmed). */
export type StoredWeek = { sunday: string; notice_id: number | null; special: boolean; items: HistoryItem[] };

export type SaveDecision =
  | { action: "skip"; reason: "no-notice" | "in-history" | "already-published" | "review-unchanged" }
  | { action: "write"; status: "auto" | "review" };

/**
 * The Cron may run twice for one Friday (Vercel: best effort, possibly more than once), so a published week is
 * never overwritten. A week waiting for review is rewritten: a later reading may succeed.
 */
export function planSave(
  reading: { notice: unknown; items: unknown[]; review: unknown[] },
  existing: StoredStatus | null,
  inHistory: boolean,
): SaveDecision {
  if (!reading.notice) return { action: "skip", reason: "no-notice" };
  if (inHistory) return { action: "skip", reason: "in-history" };
  if (existing === "auto" || existing === "confirmed") return { action: "skip", reason: "already-published" };
  return { action: "write", status: reading.review.length > 0 || reading.items.length === 0 ? "review" : "auto" };
}

/** The two database steps of a save, injected so the rule below can be tested without a database. */
export type WeekWriter = {
  /** Inserts the row; "exists" when a row for this Sunday is already there (unique violation). */
  insert(): Promise<"ok" | "exists">;
  /** Replaces the row only while it still waits for review (one conditional UPDATE); false when it does not. */
  replaceIfReview(): Promise<boolean>;
};

/**
 * Writes without ever replacing a published week, even when two runs overlap or a person confirms the week
 * between this run's read and its write (Codex review 2026-11-10: read-then-upsert let a late "review" reading
 * overwrite an "auto" row). The database decides: insert, and on conflict update only `where status = 'review'`.
 */
export async function writeOnce(writer: WeekWriter, status: "auto" | "review"): Promise<SaveDecision> {
  if ((await writer.insert()) === "ok") return { action: "write", status };
  return (await writer.replaceIfReview()) ? { action: "write", status } : { action: "skip", reason: "already-published" };
}

/**
 * True when a week is already waiting for review with this very notice (same id, same images). Reading it again
 * would give the same result and spend OCR calls (100 free a month), so the Cron skips it until the notice changes.
 */
export function sameNoticeWaiting(
  row: { status: StoredStatus; notice_id: number | null; images: unknown } | null,
  notice: { id: number; images: string[] },
): boolean {
  if (row?.status !== "review" || row.notice_id !== notice.id || !Array.isArray(row.images)) return false;
  return row.images.length === notice.images.length && row.images.every((url, i) => url === notice.images[i]);
}

/** Bundled history plus stored weeks after it; a date already in the history keeps the history version. */
export function mergeStored(history: SundayWeek[], rows: StoredWeek[]): SundayWeek[] {
  const have = new Set(history.map((w) => w.date));
  const extra = rows
    .filter((r) => !have.has(r.sunday))
    .map((r) => toWeek({ date: r.sunday, event: null, special: r.special, notice: r.notice_id ? [r.notice_id] : [], items: r.items }));
  return extra.length ? [...history, ...extra].sort((a, b) => (a.date < b.date ? -1 : 1)) : history;
}
