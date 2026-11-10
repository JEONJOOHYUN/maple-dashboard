// Server-only OCR for Sunday Maple notice images (PaddleOCR Korean PP-OCRv5 via ONNX).
// Benchmark (2026-11-10, 167 weeks): grayscale + normalize is required; without it,
// orange text on yellow panels ("50% 할인") is dropped. Details: C:/dev/_work/sunday-ocr-test/README.md
import sharp from "sharp";
import { PaddleOcrService, V5_KOREAN_MOBILE_MODEL } from "ppu-paddle-ocr";

let service: Promise<PaddleOcrService> | null = null;

// Models are fetched into memory instead of the library's ~/.cache, which is read-only on Vercel.
async function fetchModel(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`OCR model download failed (${res.status}): ${url}`);
  return res.arrayBuffer();
}

function getService(): Promise<PaddleOcrService> {
  service ??= (async () => {
    const [detection, recognition, charactersDictionary] = await Promise.all([
      fetchModel(V5_KOREAN_MOBILE_MODEL.detection),
      fetchModel(V5_KOREAN_MOBILE_MODEL.recognition),
      fetchModel(V5_KOREAN_MOBILE_MODEL.charactersDictionary),
    ]);
    const ocr = new PaddleOcrService({ model: { detection, recognition, charactersDictionary } });
    await ocr.initialize();
    return ocr;
  })().catch((error) => {
    service = null; // allow a retry on the next call
    throw error;
  });
  return service;
}

/** Reads all text in one notice image, line by line. */
export async function readNoticeImage(image: ArrayBuffer): Promise<string> {
  const gray = await sharp(Buffer.from(image)).grayscale().normalize().png().toBuffer();
  const ocr = await getService();
  const bytes = gray.buffer.slice(gray.byteOffset, gray.byteOffset + gray.byteLength) as ArrayBuffer;
  const result = await ocr.recognize(bytes);
  return result.text;
}
