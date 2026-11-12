// Dates for the history API are KST calendar days ("2026-11-10"); record times are ms epochs.
const H9 = 9 * 3_600_000;
export const DAY = 86_400_000;

export const kstDate = (t: number) => new Date(t + H9).toISOString().slice(0, 10);
/** 0 = Sunday … 6 = Saturday, in KST. */
export const kstWeekday = (t: number) => new Date(t + H9).getUTCDay();
/** Start of a KST day as ms epoch. */
export const dayStart = (date: string) => Date.parse(`${date}T00:00:00+09:00`);
export const addDays = (date: string, n: number) => kstDate(dayStart(date) + n * DAY);

/** Every day from `to` back to `from` (both included), newest first. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = to; d >= from; d = addDays(d, -1)) out.push(d);
  return out;
}

/** "11/5 23:42" in KST. */
export function kstStamp(t: number): string {
  const d = new Date(t + H9);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

/** "11/5" in KST. */
export function kstShort(t: number): string {
  const d = new Date(t + H9);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** "2026.02.15 12:50" in KST. */
export function kstFull(t: number): string {
  const d = new Date(t + H9);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${two(d.getUTCMonth() + 1)}.${two(d.getUTCDate())} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}
