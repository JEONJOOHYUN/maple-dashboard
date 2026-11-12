// Draws the boss-split result as a PNG on a canvas (no extra dependency), using
// the page's current theme colors and fonts, for "이미지 복사".

export type SplitImageCard = {
  name: string;
  pctLabel: string;
  amount: string;
  kor: string;
  role: string;
  highlight: boolean;
};

export type SplitImageData = {
  summary: string;
  cards: SplitImageCard[];
  note: string;
};

const WIDTH = 760;
const PAD = 28;
const GAP = 12;
const CARD_BASE_H = 132; // card height with a one-line role
const ROLE_LINE_H = 16;
const SCALE = 2;

function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Packs " · "-separated parts into lines no wider than maxWidth (canvas text never wraps). */
function wrapParts(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

/** Shrinks the font size until `text` fits in `maxWidth`. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, size: number, maxWidth: number) {
  let s = size;
  ctx.font = `700 ${s}px ${family}`;
  while (s > 14 && ctx.measureText(text).width > maxWidth) {
    s -= 1;
    ctx.font = `700 ${s}px ${family}`;
  }
}

export async function renderSplitImage(data: SplitImageData): Promise<Blob> {
  const body = `"Pretendard Variable", "Malgun Gothic", sans-serif`;
  const maple = cssVar("--font-maple", "");
  const num = maple ? `${maple}, ${body}` : body;

  const allText = [data.summary, data.note, "계산 결과 메이플 대시보드", ...data.cards.flatMap((c) => [c.name, c.pctLabel, c.kor, c.role])].join("");
  // Pretendard is split by unicode-range, so ask for exactly the glyphs we draw.
  await Promise.all([
    document.fonts.load(`700 16px ${body}`, allText),
    document.fonts.load(`400 13px ${body}`, allText),
    document.fonts.load(`700 28px ${num}`, "0123456789,"),
  ]).catch(() => undefined);

  const color = {
    bg: cssVar("--card", "#1d1c19"),
    inner: cssVar("--background", "#121210"),
    text: cssVar("--foreground", "#f4f0e8"),
    muted: cssVar("--muted-foreground", "#aba498"),
    line: cssVar("--border", "#34312b"),
    chip: cssVar("--muted", "#272520"),
    primary: cssVar("--primary", "#ff7429"),
    primaryText: cssVar("--primary-text", "#ff8a4c"),
    primarySoft: cssVar("--primary-soft", "rgba(255,116,41,0.14)"),
  };

  const cols = data.cards.length === 4 ? 2 : Math.min(data.cards.length, 3);
  const rows = Math.ceil(data.cards.length / cols);
  const cardW = (WIDTH - PAD * 2 - GAP * (cols - 1)) / cols;
  // A short last row (5 people = 3 + 2) sits in the middle, like the page.
  const lastRowShift = ((rows * cols - data.cards.length) * (cardW + GAP)) / 2;

  // Measure role lines first so every card in the image gets the same, sufficient height.
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("canvas unavailable");
  measure.font = `400 12px ${body}`;
  const roleLines = data.cards.map((c) => wrapParts(measure, c.role, cardW - 20));
  const maxLines = Math.max(1, ...roleLines.map((l) => l.length));
  const CARD_H = CARD_BASE_H + maxLines * ROLE_LINE_H;
  const height = PAD + 32 + 18 + rows * CARD_H + (rows - 1) * GAP + 24 + 18 + 28 + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = color.bg;
  ctx.fillRect(0, 0, WIDTH, height);

  // Header
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = color.text;
  ctx.font = `700 22px ${body}`;
  ctx.fillText("계산 결과", PAD, PAD + 24);
  ctx.textAlign = "right";
  ctx.fillStyle = color.muted;
  ctx.font = `400 13px ${body}`;
  ctx.fillText(data.summary, WIDTH - PAD, PAD + 24);

  // Cards
  const top = PAD + 32 + 18;
  data.cards.forEach((c, i) => {
    const row = Math.floor(i / cols);
    const x = PAD + (i % cols) * (cardW + GAP) + (row === rows - 1 ? lastRowShift : 0);
    const y = top + row * (CARD_H + GAP);
    const cx = x + cardW / 2;

    roundRect(ctx, x, y, cardW, CARD_H, 8);
    ctx.fillStyle = color.inner;
    ctx.fill();
    if (c.highlight) {
      ctx.fillStyle = color.primarySoft;
      ctx.fill();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = c.highlight ? color.primary : color.line;
    ctx.stroke();

    // name + percent badge, centered as one line
    ctx.font = `700 14px ${body}`;
    const nameW = ctx.measureText(c.name).width;
    ctx.font = `700 12px ${body}`;
    const badgeW = ctx.measureText(c.pctLabel).width + 16;
    const lineW = nameW + 6 + badgeW;
    let lx = cx - lineW / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = color.text;
    ctx.font = `700 14px ${body}`;
    ctx.fillText(c.name, lx, y + 32);
    lx += nameW + 6;
    roundRect(ctx, lx, y + 17, badgeW, 20, 10);
    ctx.fillStyle = color.chip;
    ctx.fill();
    ctx.fillStyle = color.text;
    ctx.font = `700 12px ${body}`;
    ctx.fillText(c.pctLabel, lx + 8, y + 31);

    ctx.textAlign = "center";
    ctx.fillStyle = c.highlight ? color.primaryText : color.text;
    fitFont(ctx, c.amount, num, 28, cardW - 24);
    ctx.fillText(c.amount, cx, y + 78);

    ctx.fillStyle = color.muted;
    ctx.font = `400 13px ${body}`;
    ctx.fillText(c.kor, cx, y + 104);
    ctx.font = `400 12px ${body}`;
    roleLines[i].forEach((line, li) => ctx.fillText(line, cx, y + 126 + li * ROLE_LINE_H));
  });

  // Footer
  const noteY = top + rows * CARD_H + (rows - 1) * GAP + 30;
  ctx.textAlign = "center";
  ctx.fillStyle = color.muted;
  ctx.font = `400 12px ${body}`;
  ctx.fillText(data.note, WIDTH / 2, noteY);
  ctx.strokeStyle = color.line;
  ctx.beginPath();
  ctx.moveTo(PAD, noteY + 16);
  ctx.lineTo(WIDTH - PAD, noteY + 16);
  ctx.stroke();
  ctx.textAlign = "right";
  ctx.font = `700 12px ${body}`;
  ctx.fillText("메이플 대시보드", WIDTH - PAD, noteY + 40);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png")
  );
}
