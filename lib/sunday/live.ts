// History for the pages: the bundled JSON plus published weeks from sunday_weeks (filled by the Friday Cron).
// A database problem never breaks the page; it falls back to the bundled history.
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { SUNDAYS, type SundayWeek } from "./history";
import { ML_MODEL, type MlScores } from "./ml";
import { mergePatches, type StoredPatch } from "./patches";
import { SEASON_PATCHES, type SeasonPatch } from "./predict";
import { mergeStored, type StoredWeek } from "./stored";

/** Cache tag of the published rows; the Cron clears it as soon as it publishes a week. */
export const SUNDAY_WEEKS_TAG = "sunday-weeks";

// The pages render on every request (the week rolls over at Monday 00:00 KST), so the rows are cached here
// instead of in the page. A failed read throws, and a thrown error is not cached.
const loadPublishedRows = unstable_cache(
  async (): Promise<StoredWeek[]> => {
    const { data, error } = await supabase
      .from("sunday_weeks")
      .select("sunday, notice_id, special, items, updated_at, images")
      .in("status", ["auto", "confirmed"])
      .order("sunday");
    if (error) throw error;
    return (data ?? []) as StoredWeek[];
  },
  // "-v3": the rows carry updated_at · images (rows cached before them would come back without).
  ["sunday-weeks-v3"],
  { revalidate: 3600, tags: [SUNDAY_WEEKS_TAG] },
);

export async function loadSundayWeeks(): Promise<SundayWeek[]> {
  try {
    return mergeStored(SUNDAYS, await loadPublishedRows());
  } catch (e) {
    console.error("sunday_weeks read failed, using bundled history only", e);
    return SUNDAYS;
  }
}

// Season patch dates the Cron found in the event notices (patches.ts), cached with the weeks: the Cron clears the same
// tag when it writes one.
const loadPatchRows = unstable_cache(
  async (): Promise<StoredPatch[]> => {
    const { data, error } = await supabase.from("sunday_patches").select("season_key, date, season, confirmed").order("date");
    if (error) throw error;
    return (data ?? []) as StoredPatch[];
  },
  ["sunday-patches-v1"],
  { revalidate: 3600, tags: [SUNDAY_WEEKS_TAG] },
);

/** The season patch dates for every prediction on the pages; the bundled list alone when the rows cannot be read. */
export async function loadSeasonPatches(): Promise<SeasonPatch[]> {
  try {
    return mergePatches(SEASON_PATCHES, await loadPatchRows());
  } catch (e) {
    console.error("sunday_patches read failed, using the bundled patch dates", e);
    return SEASON_PATCHES;
  }
}

/** Cache tag of the foundation-model scores; the upload route (app/api/sunday/ml) clears it. */
export const SUNDAY_ML_TAG = "sunday-ml";

// The upcoming Sunday's scores plus the past year's: the hit record (hits.ts) predicts the last 52 Sundays again.
const ML_ROWS = 64;

const loadMlRows = unstable_cache(
  async (): Promise<MlScores[]> => {
    const { data, error } = await supabase
      .from("sunday_ml_scores")
      .select("sunday, model, data_end, data_hash, scores")
      .eq("model", ML_MODEL)
      .order("sunday", { ascending: false })
      .limit(ML_ROWS);
    if (error) throw error;
    return (data ?? []) as MlScores[];
  },
  // "-v2": 64 rows instead of 8 (entries cached before would come back short).
  ["sunday-ml-v2", ML_MODEL],
  { revalidate: 3600, tags: [SUNDAY_ML_TAG] },
);

/** Recent foundation-model scores (ml.ts); none, so the statistical model alone, when they cannot be read. */
export async function loadMlScores(): Promise<MlScores[]> {
  try {
    return await loadMlRows();
  } catch (e) {
    console.error("sunday_ml_scores read failed, using the statistical model alone", e);
    return [];
  }
}
