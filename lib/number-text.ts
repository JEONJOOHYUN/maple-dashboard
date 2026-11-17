// Number fields keep the plain text ("1234567.5") and show it with commas ("1,234,567.5"):
// every field writes 1,000 · 1,000,000 the same way (user, 2026-11-17).

const keepRe = (decimal: boolean) => (decimal ? /[0-9.]/ : /[0-9]/);

/** What was typed → digits (and one "." when decimals are allowed), at most 12 characters. Commas drop out. */
export function cleanNumberText(text: string, decimal = false): string {
  const kept = text.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "");
  const dot = kept.indexOf(".");
  const one = dot < 0 ? kept : kept.slice(0, dot + 1) + kept.slice(dot + 1).replace(/\./g, "");
  return one.slice(0, 12);
}

/** "1234567.5" → "1,234,567.5": commas in the whole part only, the rest as typed ("1." stays "1."). */
export function groupDigits(text: string): string {
  const dot = text.indexOf(".");
  const whole = dot < 0 ? text : text.slice(0, dot);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dot < 0 ? grouped : grouped + text.slice(dot);
}

/** How many kept characters (digits, ".") sit before `caret` in the field's text. */
export function keptBefore(text: string, caret: number, decimal = false): number {
  const re = keepRe(decimal);
  let n = 0;
  for (let i = 0; i < Math.min(caret, text.length); i++) if (re.test(text[i])) n++;
  return n;
}

/** Caret position right after the `kept`-th kept character of `text`, so commas added or removed do not move it. */
export function caretAfter(text: string, kept: number, decimal = false): number {
  if (kept <= 0) return 0;
  const re = keepRe(decimal);
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (re.test(text[i])) n++;
    if (n === kept) return i + 1;
  }
  return text.length;
}
