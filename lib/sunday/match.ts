// Turns OCR lines of a Sunday Maple notice image into known benefit names for one Sunday.
// Anything the matcher is not sure about goes to `review` instead of `items`, so a wrong guess is never saved silently.
// Rules come from the 167-week benchmark (C:/dev/_work/sunday-ocr-test/README.md):
//  - one notice can cover several Sundays → keep only the section whose "이벤트 기간" date is this Sunday
//  - "챌린저스 월드 전용" blocks sit at the end of a section and are not recorded → cut from there on
//  - a benefit title is a whole line (or two wrapped lines); matching inside long body text gives false hits
//  - digits decide variants ("경험치 2배" vs "3배"); a title whose digits do not agree is never accepted

export type OcrLine = { t: string; h?: number };

export type KnownBenefit = { name: string; tags?: string[] };

export type MatchedItem = { name: string; tags?: string[]; score: number; line: string };

export type ReviewKind =
  | "no-section" // multi-week notice without a section for this Sunday
  | "number" // title found but its digits differ from every known variant
  | "uncertain" // looks like a known benefit but too many characters differ
  | "unknown" // title-like line that matches no known benefit
  | "empty"; // nothing matched at all

export type ReviewNote = { kind: ReviewKind; line: string; guess?: string };

export type NoticeMatch = { items: MatchedItem[]; review: ReviewNote[]; sundays: string[] };

/** Group headings that tag the benefits listed under them (see history.json `tags`). */
export const TAG_HEADINGS = ["샤이닝 스타포스 타임", "솔 에르다 타임"] as const;

const LINE_MIN = 0.8; // whole-line similarity to accept a title
const PART_MIN = 0.75; // a line that covers most of a longer title
const LOOSE_MIN = 0.88; // substring similarity that only earns a review note

const DATE_LINE = /이벤트\s*기간.*?(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
// The first letter is often misread (챔/첼/헬/캘린저스), so it is left out.
const CHALLENGERS = /린저스\s*월드\s*전용/;
// Benefit titles end like this; body sentences end in "~니다". (Line height did not separate titles across designs.)
// "배" without a digit catches titles whose number OCR dropped ("트레져 헌터 경험치 배").
const TITLE_END = /(할인|배|증가|지급|감소|\d+%|강화|누적|타임)$/;
// Fixed notice furniture, table cells and notes that end like a title but are never a benefit.
const FURNITURE = /이벤트기간|SUNDAYMAPLE|메이플스토리|바로가기|궁금하다면|SPECIAL|TIP|폭풍|확률표|혜택|평일클리어|기본경험치.*\d+%$|^기본경험치의\d+배$|일요일경험치|승급될확률|단계씩/;
const NOTE_START = /^\s*[·•*※\-ㆍ]/;
const TABLE_CELL = /:\s*\d|\d\.\d+%/; // "1성 몬스터 등록 확률: 60%", "0.1996%"
const SENTENCE_END = /(니다|[.)])\s*$/;

/** Matching key: no short parenthetical notes, only Hangul / letters / digits / % / +, upper case. */
export function matchKey(s: string): string {
  return s
    .replace(/(?<=\d)[Oo]|[Oo](?=\d)/g, "0") // "1O개" → "10개"
    .replace(/\([^()\n]{0,20}\)/g, "")
    .replace(/[^0-9A-Za-z가-힣%+]/g, "")
    .toUpperCase();
}

const digitsOf = (key: string) => (key.match(/\d+/g) ?? []).join(",");

const BRACKET = /\([^()\n]{0,20}\)/g;
/** Digits inside short brackets ("경험치 3배 쿠폰(30분)" → "30"); matchKey drops brackets, so they are checked here. */
const bracketDigits = (raw: string) => (raw.replace(/(?<=\d)[Oo]|[Oo](?=\d)/g, "0").match(BRACKET) ?? []).map(digitsOf).filter(Boolean).join(",");

function lev(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Best edit distance of `p` against any substring of `t`. */
function subLev(p: string, t: string): number {
  let prev = Array.from({ length: p.length + 1 }, (_, i) => i);
  let best = p.length;
  for (let j = 1; j <= t.length; j++) {
    const cur = [0];
    for (let i = 1; i <= p.length; i++) {
      cur[i] = Math.min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + (p[i - 1] === t[j - 1] ? 0 : 1));
    }
    best = Math.min(best, cur[p.length]);
    prev = cur;
  }
  return best;
}

const sim = (a: string, b: string) => (a.length || b.length ? 1 - lev(a, b) / Math.max(a.length, b.length) : 0);

/** Lines of this Sunday's section, plus every Sunday the notice announces. */
function sectionFor(lines: OcrLine[], sunday: string): { lines: OcrLine[]; sundays: string[]; found: boolean } {
  const starts: { i: number; date: string }[] = [];
  lines.forEach((l, i) => {
    const m = l.t.match(DATE_LINE);
    if (!m) return;
    const date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    if (starts.at(-1)?.date !== date) starts.push({ i, date });
  });
  const sundays = [...new Set(starts.map((s) => s.date))];
  let part = lines; // no date line read: treat the whole notice as one week
  if (starts.length > 0) {
    const k = starts.findIndex((s) => s.date === sunday);
    if (k < 0) return { lines: [], sundays, found: false };
    const end = starts.slice(k + 1).find((s) => s.date !== sunday)?.i ?? lines.length;
    part = lines.slice(starts[k].i, end);
  }
  // Applies with or without a date line (Codex review 2026-11-10: a missed date line kept the challengers block).
  const cut = part.findIndex((l) => CHALLENGERS.test(l.t.replace(/\s+/g, " ")));
  if (cut >= 0) part = part.slice(0, cut);
  return { lines: part, sundays, found: true };
}

type Segment = { key: string; text: string; from: number; to: number };

/**
 * `ignored`: titles that appear in Sunday notices but are deliberately not recorded (event-linked rewards such as
 * "연회의 축복 경험치 획득량 4배"). They are matched like known benefits and then dropped, so they do not raise "unknown".
 */
export function matchNotice(lines: OcrLine[], sunday: string, known: KnownBenefit[], ignored: string[] = []): NoticeMatch {
  const section = sectionFor(lines, sunday);
  if (!section.found) {
    return { items: [], review: [{ kind: "no-section", line: `공지에 있는 날짜: ${section.sundays.join(", ")}` }], sundays: section.sundays };
  }
  const part = section.lines;
  const segs: Segment[] = [];
  part.forEach((l, i) => {
    const one = matchKey(l.t);
    if (one) segs.push({ key: one, text: l.t.trim(), from: i, to: i });
    const next = part[i + 1];
    if (next && one) segs.push({ key: one + matchKey(next.t), text: `${l.t.trim()} ${next.t.trim()}`, from: i, to: i + 1 });
  });

  const names = [
    ...known.map((b) => ({ ...b, key: matchKey(b.name), ignore: false })),
    ...ignored.map((name) => ({ name, tags: undefined, key: matchKey(name), ignore: true })),
  ];
  const tagNames = new Set<string>(TAG_HEADINGS);

  // Best segment per benefit: the whole line, or a line that is most of the title ("'VIP 부스터' 10개 지급"
  // printed without its small "접속 시" prefix).
  type Cand = { b: (typeof names)[number]; seg: Segment; score: number };
  const cands: Cand[] = [];
  for (const b of names) {
    let best: Cand | null = null;
    for (const seg of segs) {
      let score = sim(b.key, seg.key);
      if (score < LINE_MIN && seg.key.length >= 6 && seg.key.length < b.key.length) {
        const part = (seg.key.length / b.key.length) * (1 - subLev(seg.key, b.key) / seg.key.length);
        if (part >= PART_MIN) score = Math.max(score, part);
      }
      if (score >= Math.min(LINE_MIN, PART_MIN) && (!best || score > best.score)) best = { b, seg, score };
    }
    if (best) cands.push(best);
  }

  // Greedy: higher score first; one line belongs to one benefit.
  cands.sort((x, y) => y.score - x.score);
  const used = new Set<number>();
  const picked: Cand[] = [];
  const review: ReviewNote[] = [];
  for (const c of cands) {
    let clash = false;
    for (let i = c.seg.from; i <= c.seg.to; i++) if (used.has(i)) clash = true;
    if (clash) continue;
    // Digits decide variants: prefer a known name whose digits equal the line's digits. A line may carry extra
    // trailing digits from a neighbouring note ("룬 경험치 버프 효과 +100% (3배)"), so a digit prefix also agrees.
    // Bracket digits ("(30분)") also tell variants apart: when the line prints a bracket, its digits must match.
    // A line without any bracket passes (the elite-monster title is printed without "(1마리→3마리)").
    const lineDigits = digitsOf(c.seg.key);
    const lineBracket = c.seg.text.match(BRACKET) ? bracketDigits(c.seg.text) : null;
    const agrees = (n: { key: string; name: string }) => {
      const d = digitsOf(n.key);
      const main = d === lineDigits || (d !== "" && lineDigits.startsWith(`${d},`));
      const want = bracketDigits(n.name);
      return main && (want === "" || lineBracket === null || lineBracket === want);
    };
    if (!agrees(c.b)) {
      const stem = c.b.key.replace(/\d+/g, "#");
      const twin = names.find((n) => n.key.replace(/\d+/g, "#") === stem && agrees(n));
      if (!twin) {
        review.push({ kind: "number", line: c.seg.text, guess: c.b.name });
        for (let i = c.seg.from; i <= c.seg.to; i++) used.add(i);
        continue;
      }
      if (picked.some((p) => p.b.name === twin.name)) continue;
      picked.push({ ...c, b: twin });
    } else {
      if (picked.some((p) => p.b.name === c.b.name)) continue;
      picked.push(c);
    }
    for (let i = c.seg.from; i <= c.seg.to; i++) used.add(i);
  }

  // Group headings: tag the members found under them; drop the bare heading when its members are listed.
  const headings = TAG_HEADINGS.filter((h) => part.some((l) => sim(matchKey(h), matchKey(l.t)) >= LINE_MIN));
  const items: MatchedItem[] = [];
  for (const p of picked) {
    if (p.b.ignore) continue;
    if (tagNames.has(p.b.name) && picked.some((q) => q.b.tags?.includes(p.b.name))) continue;
    const tags = p.b.tags?.filter((t) => (headings as string[]).includes(t));
    items.push({ name: p.b.name, ...(tags?.length ? { tags } : {}), score: Math.round(p.score * 100) / 100, line: p.seg.text });
  }

  // Known benefits seen only loosely inside longer text: worth a look, never saved automatically.
  // Skips variants of a benefit already found: "경험치 3배" in its own title also looks like "경험치 2배".
  const stems = new Set(picked.map((p) => p.b.key.replace(/\d+/g, "#")));
  const whole = matchKey(part.map((l) => l.t).join(" "));
  for (const b of names) {
    if (b.ignore || picked.some((p) => p.b.name === b.name) || tagNames.has(b.name) || b.key.length < 10) continue;
    if (stems.has(b.key.replace(/\d+/g, "#"))) continue;
    if (1 - subLev(b.key, whole) / b.key.length >= LOOSE_MIN) review.push({ kind: "uncertain", line: "(본문 속)", guess: b.name });
  }

  // Title-like lines that nothing claimed: a benefit we have never seen, or a known one OCR mangled.
  // A title can wrap ("룬 경험치 버프 효과" / "+100%"), so an unclaimed line is also tried together with the next one.
  const titleLike = (text: string) => {
    const key = matchKey(text);
    if (key.length < 5 || key.length > 40 || !TITLE_END.test(key) || FURNITURE.test(key)) return false;
    if ((key.match(/[가-힣]/g) ?? []).length < 4) return false; // "+ + 400%" table fragments
    const unopened = (text.match(/\)/g) ?? []).length > (text.match(/\(/g) ?? []).length; // tail of a wrapped note
    if (NOTE_START.test(text) || TABLE_CELL.test(text) || unopened || (key.match(/%/g) ?? []).length >= 2) return false;
    return !TAG_HEADINGS.some((h) => sim(matchKey(h), key) >= LINE_MIN);
  };
  for (let i = 0; i < part.length; i++) {
    if (used.has(i)) continue;
    const one = part[i].t.trim();
    if (titleLike(one)) {
      review.push({ kind: "unknown", line: one });
      continue;
    }
    const next = part[i + 1];
    if (next && !used.has(i + 1) && !NOTE_START.test(one) && !SENTENCE_END.test(one) && titleLike(`${one} ${next.t.trim()}`)) {
      review.push({ kind: "unknown", line: `${one} ${next.t.trim()}` });
      i++;
    }
  }

  if (items.length === 0 && review.length === 0) review.push({ kind: "empty", line: "" });
  return { items, review, sundays: section.sundays };
}

/** Known benefits with the group tags they have carried in the history (input for matchNotice). */
export function knownBenefits(names: string[], weeks: { items: { name: string; tags?: string[] }[] }[]): KnownBenefit[] {
  const tags = new Map<string, Set<string>>();
  for (const w of weeks) for (const it of w.items) for (const t of it.tags ?? []) tags.set(it.name, (tags.get(it.name) ?? new Set()).add(t));
  return names.map((name) => ({ name, ...(tags.has(name) ? { tags: [...tags.get(name)!] } : {}) }));
}
