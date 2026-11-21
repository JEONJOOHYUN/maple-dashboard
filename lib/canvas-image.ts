// Shared pieces for the result pictures drawn on a canvas (boss split, starforce quote): theme colours read from
// the page, a few drawing helpers, and the "copy as picture" step with its file fallback.

/** A theme token as the page has it now (light or dark), or `fallback` when it is not set. */
export function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Packs " · "-separated parts into lines no wider than maxWidth (canvas text never wraps). */
export function wrapParts(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const part of text.split(" · ")) {
    const last = lines[lines.length - 1];
    if (last !== undefined && ctx.measureText(`${last} · ${part}`).width <= maxWidth) {
      lines[lines.length - 1] = `${last} · ${part}`;
    } else {
      lines.push(part);
    }
  }
  return lines;
}

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png")
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ImageCopyResult = "copied" | "saved" | "error";

/**
 * Puts the picture on the clipboard; where that is not allowed (no image clipboard, blocked permission) it is saved
 * as a file instead. Call it straight from the click handler with the promise, not the finished blob: Safari only
 * accepts a ClipboardItem made inside the click itself.
 */
export async function copyImage(blobPromise: Promise<Blob>, filename: string): Promise<ImageCopyResult> {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("no image clipboard");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
    return "copied";
  } catch {
    try {
      downloadBlob(await blobPromise, filename);
      return "saved";
    } catch {
      return "error";
    }
  }
}
