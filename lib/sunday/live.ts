// History for the pages: the bundled JSON plus published weeks from sunday_weeks (filled by the Friday Cron).
// A database problem never breaks the page; it falls back to the bundled history.
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { SUNDAYS, type SundayWeek } from "./history";
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
