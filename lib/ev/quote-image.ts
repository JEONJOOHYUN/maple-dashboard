// Draws the starforce quote (견적서) as a PNG on a canvas, in the page's current theme, for "사진 복사".
// Every value arrives as the text the page already shows, so the picture cannot disagree with the screen.

import { canvasBlob, cssVar, roundRect, wrapParts } from "@/lib/canvas-image";

export type QuoteImageRow = {
  item: string;
  /** "Lv.200 · 샤타포스 · 최적화 · 노작 10억" — wrapped at the " · " marks. */
  sub: string;
  range: string;
  cost: string;
  quote: string;
  destroys: string;
  tries: string;
};

export type QuoteImageData = {
  /** "×1.07" — the head of the quote column. */
  multLabel: string;
  rows: QuoteImageRow[];
  total: { label: string; cost: string; quote: string; destroys: string; tries: string };
  final: { title: string; meso: string; won: string; before: string };
};

const MIN_WIDTH = 760;
const PAD = 28;
const SCALE = 2;
// A canvas past these fails to export on some browsers (older iOS Safari: 4096 × 4096 in area), and the cart has no
// row limit: a very long quote is drawn at a lower scale instead of not at all.
const MAX_AREA = 16_000_000;
const MAX_SIDE = 16_000;
const ROW_PAD = 12; // the row fill reaches this far past the text on both sides, as on the page: the text itself keeps the title's edge
const COL_GAP = 24;
const FIRST_MIN = 240;
const NUM_SIZE = 15;
const DIGIT_EM = 0.68; // one width for every digit, same as <Digits>
const HEAD_H = 30;
const SUB_LINE_H = 15;
const TOTAL_H = 42;
const BAND_H = 98;

const isDigit = (ch: string) => ch >= "0" && ch <= "9";

function numWidth(ctx: CanvasRenderingContext2D, text: string, size: number) {
  let w = 0;
  for (const ch of text) w += isDigit(ch) ? size * DIGIT_EM : ctx.measureText(ch).width;
  return w;
}

/** A right-aligned number whose digits each take the same width, so a column lines up digit under digit. */
function drawNum(ctx: CanvasRenderingContext2D, text: string, right: number, y: number, size: number) {
  let x = right - numWidth(ctx, text, size);
  for (const ch of text) {
    if (isDigit(ch)) {
      const cell = size * DIGIT_EM;
      ctx.textAlign = "center";
      ctx.fillText(ch, x + cell / 2, y);
      x += cell;
    } else {
      ctx.textAlign = "left";
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width;
    }
  }
}

/**
 * "12 → 17성" in pieces: the numbers in the number font, the arrow in the page's body stack. Left to the number
 * font's fallbacks the arrow comes out long and thin, which is why the page sets it in the body font too.
 */
function rangePieces(text: string, numFont: string, arrowFont: string) {
  const [from, to = ""] = text.split("→");
  return [
    { text: from, font: numFont },
    { text: to ? "→" : "", font: arrowFont },
    { text: to, font: numFont },
  ];
}

function rangeWidth(ctx: CanvasRenderingContext2D, text: string, numFont: string, arrowFont: string) {
  let w = 0;
  for (const piece of rangePieces(text, numFont, arrowFont)) {
    ctx.font = piece.font;
    w += ctx.measureText(piece.text).width;
  }
  return w;
}

function drawRange(ctx: CanvasRenderingContext2D, text: string, left: number, y: number, numFont: string, arrowFont: string) {
  let x = left;
  ctx.textAlign = "left";
  for (const piece of rangePieces(text, numFont, arrowFont)) {
    ctx.font = piece.font;
    ctx.fillText(piece.text, x, y);
    x += ctx.measureText(piece.text).width;
  }
}

export async function renderQuoteImage(data: QuoteImageData): Promise<Blob> {
  const body = `"Pretendard Variable", "Malgun Gothic", sans-serif`;
  const maple = cssVar("--font-maple", "");
  const num = maple ? `${maple}, ${body}` : body;
  const numFont = `700 ${NUM_SIZE}px ${num}`;
  const arrowFont = `700 ${NUM_SIZE}px ${cssVar("--font-sans", body)}`;

  const heads = ["구간", "기댓값", data.multLabel, "파괴", "시도"];
  const cells = (r: { cost: string; quote: string; destroys: string; tries: string }) => [r.cost, r.quote, r.destroys, r.tries];
  const allText = [
    "스타포스 견적서 장비 · 조건 메이플 대시보드",
    ...heads,
    ...data.rows.flatMap((r) => [r.item, r.sub, r.range, ...cells(r)]),
    data.total.label,
    ...cells(data.total),
    ...Object.values(data.final),
  ].join("");
  // Pretendard is split by unicode-range, so ask for exactly the glyphs we draw.
  await Promise.all([
    document.fonts.load(`700 16px ${body}`, allText),
    document.fonts.load(`400 13px ${body}`, allText),
    document.fonts.load(`700 30px ${num}`, "0123456789,.x"),
  ]).catch(() => undefined);

  const color = {
    bg: cssVar("--card", "oklch(0.226 0.006 91.6)"),
    stripe: cssVar("--background", "oklch(0.181 0.004 106.8)"),
    text: cssVar("--foreground", "oklch(0.956 0.011 84.6)"),
    muted: cssVar("--muted-foreground", "oklch(0.721 0.019 81.3)"),
    line: cssVar("--border", "oklch(0.314 0.011 84.6)"),
    primary: cssVar("--primary", "oklch(0.716 0.188 44.7)"),
    primaryText: cssVar("--primary-text", "oklch(0.751 0.161 46.8)"),
    onPrimary: cssVar("--primary-foreground", "oklch(0.175 0.029 58.4)"),
  };

  // Columns: the number columns are as wide as their widest value, the first one takes the rest. A quote in 조
  // (very wide numbers) widens the picture rather than squeezing the item column.
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("canvas unavailable");
  const headFont = `500 11px ${body}`;
  const colW = heads.map((h, i) => {
    measure.font = headFont;
    let w = measure.measureText(h).width;
    measure.font = numFont;
    for (const r of data.rows) {
      w = Math.max(w, i === 0 ? rangeWidth(measure, r.range, numFont, arrowFont) : numWidth(measure, cells(r)[i - 1], NUM_SIZE));
      measure.font = numFont;
    }
    if (i > 0) w = Math.max(w, numWidth(measure, cells(data.total)[i - 1], NUM_SIZE));
    return Math.ceil(w);
  });
  const restW = colW.reduce((a, w) => a + w + COL_GAP, 0);
  // The band holds the quote on the left and the won / before-multiplier lines on the right.
  measure.font = `700 30px ${num}`;
  const bandLeftW = measure.measureText(data.final.meso).width;
  measure.font = `700 16px ${num}`;
  const wonW = measure.measureText(data.final.won).width;
  measure.font = `600 12px ${body}`;
  const bandW = Math.ceil(bandLeftW + Math.max(wonW, measure.measureText(data.final.before).width)) + 40 + 32;
  const width = Math.max(MIN_WIDTH, PAD * 2 + FIRST_MIN + restW, PAD * 2 + bandW);
  const firstW = width - PAD * 2 - restW;

  measure.font = `400 11px ${body}`;
  const subLines = data.rows.map((r) => wrapParts(measure, r.sub, firstW));
  const rowH = subLines.map((l) => 12 + 16 + l.length * SUB_LINE_H + 10);

  const tableTop = PAD + 32 + 10;
  const rowsTop = tableTop + HEAD_H;
  const totalTop = rowsTop + rowH.reduce((a, h) => a + h, 0);
  const bandTop = totalTop + TOTAL_H + 14;
  const footY = bandTop + BAND_H + 18;
  const height = footY + 24 + PAD - 6;

  const canvas = document.createElement("canvas");
  const scale = Math.min(SCALE, Math.sqrt(MAX_AREA / (width * height)), MAX_SIDE / height, MAX_SIDE / width);
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.scale(scale, scale);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = color.bg;
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.textAlign = "left";
  ctx.fillStyle = color.text;
  ctx.font = `700 22px ${body}`;
  ctx.fillText("스타포스 견적서", PAD, PAD + 24);

  // Right edges of the number columns, and the left edge of the range column.
  const textLeft = PAD;
  const textRight = width - PAD;
  const rights: number[] = [];
  let edge = textRight;
  for (let i = colW.length - 1; i >= 1; i--) {
    rights[i] = edge;
    edge -= colW[i] + COL_GAP;
  }
  const rangeLeft = edge - colW[0];

  // Head
  ctx.fillStyle = color.muted;
  ctx.font = headFont;
  ctx.fillText("장비 · 조건", textLeft, tableTop + 19);
  ctx.fillText(heads[0], rangeLeft, tableTop + 19);
  ctx.textAlign = "right";
  for (let i = 1; i < heads.length; i++) ctx.fillText(heads[i], rights[i], tableTop + 19);

  // Rows: every other one on the sheet colour with rounded ends (no rules between them), the total included.
  const stripe = (index: number, y: number, h: number) => {
    if (index % 2 === 0) return;
    roundRect(ctx, PAD - ROW_PAD, y, width - PAD * 2 + ROW_PAD * 2, h, 10);
    ctx.fillStyle = color.stripe;
    ctx.fill();
  };
  let y = rowsTop;
  data.rows.forEach((r, i) => {
    const h = rowH[i];
    stripe(i, y, h);
    ctx.textAlign = "left";
    ctx.fillStyle = color.text;
    ctx.font = `700 13px ${body}`;
    ctx.fillText(r.item, textLeft, y + 12 + 12);
    ctx.fillStyle = color.muted;
    ctx.font = `400 11px ${body}`;
    subLines[i].forEach((line, li) => ctx.fillText(line, textLeft, y + 12 + 16 + 11 + li * SUB_LINE_H));

    const mid = y + h / 2 + 5;
    ctx.fillStyle = color.text;
    drawRange(ctx, r.range, rangeLeft, mid, numFont, arrowFont);
    ctx.font = numFont;
    cells(r).forEach((text, ci) => drawNum(ctx, text, rights[ci + 1], mid, NUM_SIZE));
    y += h;
  });

  stripe(data.rows.length, totalTop, TOTAL_H);
  const totalMid = totalTop + TOTAL_H / 2 + 5;
  ctx.textAlign = "left";
  ctx.fillStyle = color.text;
  ctx.font = `700 13px ${body}`;
  ctx.fillText(data.total.label, textLeft, totalMid);
  ctx.font = numFont;
  cells(data.total).forEach((text, ci) => {
    ctx.fillStyle = ci === 1 ? color.primaryText : color.text;
    drawNum(ctx, text, rights[ci + 1], totalMid, NUM_SIZE);
  });

  // Final quote band
  roundRect(ctx, PAD, bandTop, width - PAD * 2, BAND_H, 10);
  ctx.fillStyle = color.primary;
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = color.onPrimary;
  const bx = PAD + 20;
  ctx.font = `600 13px ${body}`;
  ctx.fillText(data.final.title, bx, bandTop + 31);
  ctx.font = `700 30px ${num}`;
  ctx.fillText(data.final.meso, bx, bandTop + 72);
  ctx.textAlign = "right";
  const br = width - PAD - 20;
  ctx.font = `700 16px ${num}`;
  ctx.fillText(data.final.won, br, bandTop + 48);
  ctx.globalAlpha = 0.8;
  ctx.font = `600 12px ${body}`;
  ctx.fillText(data.final.before, br, bandTop + 72);
  ctx.globalAlpha = 1;

  // Footer
  ctx.strokeStyle = color.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, footY);
  ctx.lineTo(width - PAD, footY);
  ctx.stroke();
  ctx.textAlign = "right";
  ctx.fillStyle = color.muted;
  ctx.font = `700 12px ${body}`;
  ctx.fillText("메이플 대시보드", width - PAD, footY + 24);

  return canvasBlob(canvas);
}
