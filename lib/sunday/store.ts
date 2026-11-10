// Saves a Cron reading into sunday_weeks (server only, service role). Rules live in stored.ts.
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { SundayReading } from "./auto-update";
import { SUNDAYS } from "./history";
import type { SundayNotice } from "./notice";
import { planSave, sameNoticeWaiting, writeOnce, type SaveDecision, type StoredStatus } from "./stored";

type StoredRow = { status: StoredStatus; notice_id: number | null; images: unknown };

async function storedRow(sunday: string): Promise<StoredRow | null> {
  const { data, error } = await supabaseAdmin().from("sunday_weeks").select("status, notice_id, images").eq("sunday", sunday).maybeSingle();
  if (error) throw new Error(`sunday_weeks read: ${error.message}`);
  return (data as StoredRow | null) ?? null;
}

const inHistory = (sunday: string) => SUNDAYS.some((w) => w.date === sunday);

type Skip = Extract<SaveDecision, { action: "skip" }>;

/**
 * Checked before the notice is even looked up: the Cron runs several times a week (the notice can come out on
 * Thursday when Friday is a holiday, or after a live show), and once a week is published or already in the
 * history there is nothing to do.
 */
export async function alreadyDone(sunday: string): Promise<Skip | null> {
  if (inHistory(sunday)) return { action: "skip", reason: "in-history" };
  const status = (await storedRow(sunday))?.status;
  return status === "auto" || status === "confirmed" ? { action: "skip", reason: "already-published" } : null;
}

/**
 * Checked after the notice is found and before any OCR: a week that already waits for review with this same
 * notice is left alone. Each image read is one CLOVA call (100 free a month) and would give the same result.
 */
export async function waitingForReview(sunday: string, notice: SundayNotice): Promise<Skip | null> {
  return sameNoticeWaiting(await storedRow(sunday), notice) ? { action: "skip", reason: "review-unchanged" } : null;
}

/** One row per Cron run (sunday_cron_runs), to learn when Hobby Cron really fires. Never fails the run. */
export async function logRun(sunday: string, result: string, ms: number, detail?: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin().from("sunday_cron_runs").insert({ sunday, result, ms, detail: detail?.slice(0, 500) ?? null });
    if (error) console.error("sunday_cron_runs write failed", error.message);
  } catch (e) {
    console.error("sunday_cron_runs write failed", e);
  }
}

export async function saveReading(r: SundayReading): Promise<SaveDecision> {
  const db = supabaseAdmin();
  const decision = planSave(r, (await storedRow(r.sunday))?.status ?? null, inHistory(r.sunday));
  if (decision.action === "skip") return decision;

  const now = new Date().toISOString();
  const row = {
    sunday: r.sunday,
    status: decision.status,
    notice_id: r.notice?.id ?? null,
    notice_title: r.notice?.title ?? null,
    special: /스페셜/.test(r.notice?.title ?? ""),
    items: r.items.map((i) => ({ name: i.name, ...(i.tags ? { tags: i.tags } : {}) })),
    review: r.review,
    images: r.images,
    ocr_lines: r.lines, // [{ t, h }]: enough to run the matcher again without another OCR call
    read_at: now,
    updated_at: now,
  };
  // The status read above can be stale by now; the database has the last word (see writeOnce).
  return writeOnce(
    {
      async insert() {
        const { error } = await db.from("sunday_weeks").insert(row);
        if (!error) return "ok";
        if (error.code === "23505") return "exists"; // unique violation: a row for this Sunday is already there
        throw new Error(`sunday_weeks write: ${error.message}`);
      },
      async replaceIfReview() {
        const { data, error } = await db.from("sunday_weeks").update(row).eq("sunday", r.sunday).eq("status", "review").select("sunday");
        if (error) throw new Error(`sunday_weeks write: ${error.message}`);
        return (data ?? []).length > 0;
      },
    },
    decision.status,
  );
}
