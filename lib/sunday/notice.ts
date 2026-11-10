// Finds this week's Sunday Maple notice through the NEXON Open API and lists its images.
// The API only lists ongoing/upcoming events and refuses details of ended ones (400 OPENAPI00004, checked 2026-11-10),
// so this works only between the Friday announcement and the Sunday itself.
// Since late 2024 the benefits exist only inside the images; the hidden search text (`p.b_srch`, from 2026-10) holds
// just the big headings, not the benefit names.
import { nexonGet } from "@/lib/nexon/api";
import { pickSundayNotice, noticeImages, type EventNotice } from "./notice-parse";

export type SundayNotice = { id: number; title: string; url: string; images: string[] };

export async function findSundayNotice(sunday: string): Promise<SundayNotice | null> {
  const { event_notice } = await nexonGet<{ event_notice: EventNotice[] }>("notice-event", {});
  const hit = pickSundayNotice(event_notice ?? [], sunday);
  if (!hit) return null;
  const detail = await nexonGet<{ contents: string }>("notice-event/detail", { notice_id: String(hit.notice_id) });
  return { id: hit.notice_id, title: hit.title, url: hit.url, images: noticeImages(detail.contents ?? "") };
}
