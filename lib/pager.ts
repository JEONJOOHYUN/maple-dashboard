/**
 * Page numbers to offer under a list: the first, the last, and the current one with its neighbours; 0 = a gap ("…").
 * Never more than seven slots, so the row keeps its width (and fits a phone) from the first page to the last.
 */
export function pageSlots(page: number, pages: number): number[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  // Near an end the gap on that side would hide a single page: show the five pages of that end instead.
  const lo = page <= 4 ? 2 : Math.min(page - 1, pages - 4);
  const hi = page >= pages - 3 ? pages - 1 : Math.max(page + 1, 5);
  const out = [1];
  if (lo > 2) out.push(0);
  for (let p = lo; p <= hi; p++) out.push(p);
  if (hi < pages - 1) out.push(0);
  out.push(pages);
  return out;
}

/** The slice of a list on one page: `page` is kept inside 1 ~ pages (a list that got shorter never leaves an empty page). */
export function pageRange(page: number, total: number, size: number): { page: number; pages: number; from: number; to: number } {
  const pages = Math.max(1, Math.ceil(total / size));
  const at = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { page: at, pages, from: (at - 1) * size, to: Math.min(at * size, total) };
}
