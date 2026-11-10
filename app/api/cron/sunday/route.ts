// Weekly Sunday Maple update, called by Vercel Cron (Authorization: Bearer CRON_SECRET).
// A route handler is required here because Cron can only call an HTTP path.
// Current stage: OCR probe only (reads one official notice image and returns its text).
import { readNoticeImage } from "@/lib/sunday/ocr";

export const maxDuration = 300;

const IMAGE_HOST = "https://lwi.nexon.com/";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev && (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const img = new URL(request.url).searchParams.get("img");
  if (!img || !img.startsWith(IMAGE_HOST)) {
    return Response.json({ error: `img must start with ${IMAGE_HOST}` }, { status: 400 });
  }

  const started = Date.now();
  const res = await fetch(img, { cache: "no-store" });
  if (!res.ok) return Response.json({ error: `image ${res.status}` }, { status: 502 });
  const text = await readNoticeImage(await res.arrayBuffer());
  return Response.json({ ms: Date.now() - started, text });
}
