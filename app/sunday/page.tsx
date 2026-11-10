import type { Metadata } from "next";
import { SundayView } from "@/components/sunday/sunday-view";
import { loadSundayWeeks } from "@/lib/sunday/live";
import { getSundayPageData } from "@/lib/sunday/view";

export const metadata: Metadata = { title: "썬데이 메이플" };

// "This week" depends on the clock (the Friday 10:00 notice, the Sunday rollover), so re-render hourly.
export const revalidate = 3600;

export default async function SundayPage() {
  return <SundayView data={getSundayPageData(new Date(), await loadSundayWeeks())} />;
}
