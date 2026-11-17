// Saves a Cron reading into sunday_weeks, the shown prediction into sunday_predictions and the season patch dates the
// event notices show into sunday_patches (server only, service role). Rules live in stored.ts, prediction-log.ts and
// patches.ts.
import { nexonGet } from "@/lib/nexon/api";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { SundayReading } from "./auto-update";
import { SUNDAYS, kstDate, type SundayWeek } from "./history";
import { ML_MODEL, type MlScores } from "./ml";
import type { SundayNotice } from "./notice";
import type { EventNotice } from "./notice-parse";
import { checkSeasonPatch, eventSpans, mergePatches, type PatchCheck, type StoredPatch } from "./patches";
import { SEASON_PATCHES, type SeasonPatch } from "./predict";
import { predictionRow } from "./prediction-log";
import { mergeStored, planSave, sameNoticeWaiting, writeOnce, type SaveDecision, type StoredStatus, type StoredWeek } from "./stored";

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

/** The weeks the pages use (bundled history + published rows), read fresh: the page cache can lag a run behind. */
async function publishedWeeks(): Promise<SundayWeek[]> {
  const { data, error } = await supabaseAdmin()
    .from("sunday_weeks")
    .select("sunday, notice_id, special, items, updated_at, images")
    .in("status", ["auto", "confirmed"])
    .order("sunday");
  if (error) throw new Error(`sunday_weeks read: ${error.message}`);
  return mergeStored(SUNDAYS, (data ?? []) as StoredWeek[]);
}

/** The latest foundation-model scores, read fresh like the weeks. A failed read gives none: the row is then the
 * statistical model's, and its model column says so. */
async function mlScores(): Promise<MlScores[]> {
  const { data, error } = await supabaseAdmin()
    .from("sunday_ml_scores")
    .select("sunday, model, data_end, data_hash, scores")
    .eq("model", ML_MODEL)
    .order("sunday", { ascending: false })
    .limit(8);
  if (error) {
    console.error("sunday_ml_scores read failed", error.message);
    return [];
  }
  return (data ?? []) as MlScores[];
}

/** Stored season patch rows, read fresh (the page cache can lag a run behind). Throws when they cannot be read. */
async function patchRows(): Promise<StoredPatch[]> {
  const { data, error } = await supabaseAdmin().from("sunday_patches").select("season_key, date, season, confirmed").order("date");
  if (error) throw new Error(`sunday_patches read: ${error.message}`);
  return (data ?? []) as StoredPatch[];
}

/** The season patch dates the pages use; the bundled list when the rows cannot be read, as the pages fall back to. */
async function seasonPatches(): Promise<SeasonPatch[]> {
  try {
    return mergePatches(SEASON_PATCHES, await patchRows());
  } catch (e) {
    console.error("sunday_patches read failed, using the bundled patch dates", e);
    return SEASON_PATCHES;
  }
}

/**
 * The next season patch from the NEXON event notices (patches.ts checkSeasonPatch): writes sunday_patches when the
 * notices move or confirm it, nothing otherwise. Called first in every Cron run, so the prediction stored right after
 * already uses it. `dry` looks without writing. Never fails the run.
 */
export async function checkPatches(now: Date, dry: boolean): Promise<PatchCheck | { action: "error"; message: string }> {
  try {
    const [stored, { event_notice }] = await Promise.all([patchRows(), nexonGet<{ event_notice: EventNotice[] }>("notice-event", {})]);
    const check = checkSeasonPatch(mergePatches(SEASON_PATCHES, stored), eventSpans(event_notice ?? []), kstDate(now));
    if (check.action === "write" && !dry) {
      const { error } = await supabaseAdmin().from("sunday_patches").upsert({
        season_key: check.key,
        date: check.patch.date,
        season: check.patch.season,
        confirmed: check.patch.confirmed,
        basis: check.basis,
        evidence: check.evidence,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(`sunday_patches write: ${error.message}`);
    }
    return check;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("season patch check failed", message);
    return { action: "error", message };
  }
}

/**
 * Keeps the prediction the pages show right now, once per Sunday and model (the first row stays). Called at the start
 * of every Cron run (Wed–Sun), so a Sunday's prediction is stored days before its notice. If the weeks cannot be read
 * nothing is written: a prediction made without them would not be the one on the page. Never fails the run.
 */
export async function logPrediction(now: Date): Promise<"logged" | "exists" | "error"> {
  try {
    const [weeks, ml, patches] = await Promise.all([publishedWeeks(), mlScores(), seasonPatches()]);
    const row = predictionRow(weeks, now, ml, patches);
    const { error } = await supabaseAdmin().from("sunday_predictions").insert(row);
    if (!error) return "logged";
    if (error.code === "23505") return "exists"; // this Sunday and model are already stored
    console.error("sunday_predictions write failed", error.message);
  } catch (e) {
    console.error("sunday_predictions write failed", e);
  }
  return "error";
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
