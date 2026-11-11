import type { Metadata } from "next";
import { connection } from "next/server";
import { SundayView } from "@/components/sunday/sunday-view";
import { loadSundayWeeks } from "@/lib/sunday/live";
import { getSundayPageData } from "@/lib/sunday/view";

export const metadata: Metadata = { title: "썬데이 메이플" };

// "This week" depends on the clock: the week rolls over at Monday 00:00 KST and the notice comes Friday 10:00.
// A cached page would show last Sunday to the first visitor after the rollover, so it renders per request
// (the database rows are cached in lib/sunday/live.ts).
export default async function SundayPage() {
  await connection();
  return <SundayView data={getSundayPageData(new Date(), await loadSundayWeeks())} />;
}
