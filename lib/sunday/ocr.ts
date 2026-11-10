// Server-only OCR for Sunday Maple notice images: NAVER CLOVA OCR (General domain), called through API Gateway.
// Chosen 2026-11-10 over running PaddleOCR inside the function: on the same 67 weeks CLOVA sent 12 weeks to
// review where PaddleOCR sent 22 (both: 0 weeks saved wrong), and it needs no model download or native library.
// Details: C:/dev/_work/sunday-ocr-test/README.md
// Cost: 100 calls a month are free and one call reads one image, so callers must not read the same image twice
// (see store.ts `waitingForReview`).
// CLOVA_OCR_URL is the "APIGW Invoke URL" of the domain (https://….apigw.ntruss.com/…); the other URL the console
// shows resolves to a private address and cannot be reached from outside NAVER Cloud.
import { linesFromWords, type OcrWord } from "./ocr-lines.ts";
import type { OcrLine } from "./match.ts";

type ClovaField = { inferText?: string; boundingPoly?: { vertices?: { x?: number; y?: number }[] } };
type ClovaResponse = { images?: { inferResult?: string; message?: string; fields?: ClovaField[] }[] };

function imageFormat(bytes: Uint8Array): "png" | "jpg" {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  throw new Error("notice image is neither PNG nor JPEG");
}

function endpoint(): { url: string; secret: string } {
  const base = process.env.CLOVA_OCR_URL?.trim();
  const secret = process.env.CLOVA_OCR_SECRET?.trim();
  if (!base || !secret) throw new Error("CLOVA_OCR_URL / CLOVA_OCR_SECRET are not set");
  if (!base.startsWith("https://")) throw new Error("CLOVA_OCR_URL must be the https APIGW Invoke URL");
  return { url: `${base.replace(/\/+$/, "").replace(/\/general$/, "")}/general`, secret };
}

/** Reads one notice image into text lines, top to bottom, each with its height in pixels. One CLOVA call. */
export async function readNoticeImage(image: ArrayBuffer): Promise<OcrLine[]> {
  const { url, secret } = endpoint();
  const bytes = Buffer.from(image);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-OCR-SECRET": secret },
    body: JSON.stringify({
      version: "V2", // V1 returns no word boxes
      requestId: crypto.randomUUID(),
      timestamp: Date.now(),
      lang: "ko",
      images: [{ format: imageFormat(bytes), name: "notice", data: bytes.toString("base64") }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let body: ClovaResponse | null = null;
  try {
    body = JSON.parse(text) as ClovaResponse;
  } catch {
    // not JSON: reported below with the status
  }
  const result = body?.images?.[0];
  if (!res.ok || result?.inferResult !== "SUCCESS") {
    throw new Error(`CLOVA OCR failed (${res.status}): ${result?.message ?? text.slice(0, 200)}`);
  }
  const words: OcrWord[] = (result.fields ?? []).map((f) => {
    const vertices = f.boundingPoly?.vertices;
    if (!vertices?.length) throw new Error("CLOVA OCR returned a word without a box");
    const xs = vertices.map((v) => v.x ?? 0);
    const ys = vertices.map((v) => v.y ?? 0);
    return { text: f.inferText ?? "", x: Math.min(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  });
  return linesFromWords(words);
}
