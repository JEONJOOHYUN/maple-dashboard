// Weekly Sunday Maple update, called by Vercel Cron (Authorization: Bearer CRON_SECRET).
// A route handler is required here because Cron can only call an HTTP path. Vercel runs Cron only on the
// Production deployment; on Preview, call it by hand with the same header.
// Schedule (vercel.json, UTC): Wed–Fri in the 10 · 11 · 13 · 15 · 18 · 20 o'clock KST hours, Sat–Sun 10 o'clock only
// as a safety net (Hobby fires anywhere inside the hour). Uploads: Fri 126, Thu 23, Wed 5, Mon 1, other days 0.
// Once a week is saved, later runs stop after one DB check. 86% of 160 notices (2023-08 ~ 2026-11, image upload
// times) came out at 10:00, mostly Friday but Wed/Thu before a holiday; the latest upload was 19:20, mostly
// Thursday evenings ahead of Friday 10:00
// (C:/dev/_work/maple-sunday-data/src/upload-times.json). A notice after a live show is caught the next morning.
// Every run is logged in sunday_cron_runs to see when Hobby Cron really fires; if it is too late, add an external
// trigger such as cron-job.org (user decision 2026-11-10).
// Reads this week's notice, saves it to sunday_weeks (published right away, or held for review) and marks the
// Sunday pages for refresh. Safe to run more than once: a published week is never overwritten.
// `?sunday=YYYY-MM-DD` reads another Sunday, but NEXON lists only ongoing/upcoming events (Friday ~ Sunday).
// `?dry=1` reads without saving (it still spends one CLOVA OCR call per image: 100 free a month).
// A week that already waits for review is not read again while its notice is the same (store.ts).
// The header is required in every environment, the dev server included: the route writes to the real database
// and spends OCR calls, so opening the URL by hand must not be enough (Codex review 2026-11-10).
import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { readSunday } from "@/lib/sunday/auto-update";
import { upcomingSunday } from "@/lib/sunday/history";
import { findSundayNotice } from "@/lib/sunday/notice";
import { alreadyDone, logRun, saveReading, waitingForReview } from "@/lib/sunday/store";
import type { SaveDecision } from "@/lib/sunday/stored";

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const params = new URL(request.url).searchParams;
  const asked = params.get("sunday");
  if (asked && !/^\d{4}-\d{2}-\d{2}$/.test(asked)) {
    return Response.json({ error: "sunday must be YYYY-MM-DD" }, { status: 400 });
  }
  const sunday = asked ?? upcomingSunday(new Date());
  const dry = params.get("dry") === "1";
  const started = Date.now();
  try {
    if (!dry) {
      const done = await alreadyDone(sunday);
      if (done) {
        await logRun(sunday, done.reason, Date.now() - started);
        return Response.json({ sunday, saved: done });
      }
    }
    const notice = await findSundayNotice(sunday);
    if (!dry && notice) {
      const waiting = await waitingForReview(sunday, notice);
      if (waiting) {
        await logRun(sunday, waiting.reason, Date.now() - started, notice.title);
        return Response.json({ sunday, saved: waiting });
      }
    }
    const reading = await readSunday(sunday, notice);
    const saved: SaveDecision | { action: "skip"; reason: "dry-run" } = dry
      ? { action: "skip", reason: "dry-run" }
      : await saveReading(reading);
    if (saved.action === "write" && saved.status === "auto") {
      revalidatePath("/sunday");
      revalidatePath("/");
    }
    await logRun(sunday, saved.action === "write" ? saved.status : saved.reason, Date.now() - started, reading.notice?.title);
    const { lines, ...rest } = reading;
    return Response.json({ ...rest, lineCount: lines.length, saved });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("sunday cron failed", e);
    await logRun(sunday, "error", Date.now() - started, message);
    return Response.json({ sunday, error: message }, { status: 502 });
  }
}
