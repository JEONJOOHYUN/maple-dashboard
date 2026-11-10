// Weekly Sunday Maple update, called by Vercel Cron (Authorization: Bearer CRON_SECRET).
// A route handler is required here because Cron can only call an HTTP path.
// Current stage: reads this week's notice and returns the matched benefits; saving comes with the Supabase table.
// `?sunday=YYYY-MM-DD` reads another Sunday, but NEXON lists only ongoing/upcoming events (Friday ~ Sunday).
import { readSunday } from "@/lib/sunday/auto-update";
import { upcomingSunday } from "@/lib/sunday/history";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev && (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const asked = new URL(request.url).searchParams.get("sunday");
  if (asked && !/^\d{4}-\d{2}-\d{2}$/.test(asked)) {
    return Response.json({ error: "sunday must be YYYY-MM-DD" }, { status: 400 });
  }
  const sunday = asked ?? upcomingSunday(new Date());
  try {
    return Response.json(await readSunday(sunday));
  } catch (e) {
    console.error("sunday cron failed", e);
    return Response.json({ sunday, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
