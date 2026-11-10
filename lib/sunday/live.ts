// History for the pages: the bundled JSON plus published weeks from sunday_weeks (filled by the Friday Cron).
// A database problem never breaks the page; it falls back to the bundled history.
import { supabase } from "@/lib/supabase";
import { SUNDAYS, type SundayWeek } from "./history";
import { mergeStored, type StoredWeek } from "./stored";

export async function loadSundayWeeks(): Promise<SundayWeek[]> {
  try {
    const { data, error } = await supabase
      .from("sunday_weeks")
      .select("sunday, notice_id, special, items")
      .in("status", ["auto", "confirmed"])
      .order("sunday");
    if (error) throw error;
    return mergeStored(SUNDAYS, (data ?? []) as StoredWeek[]);
  } catch (e) {
    console.error("sunday_weeks read failed, using bundled history only", e);
    return SUNDAYS;
  }
}
