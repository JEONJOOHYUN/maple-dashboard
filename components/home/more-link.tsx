import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The small pill of a home tile's header and of the Sunday tile's links: a well in the tile with the tile's edge.
 * Under the pointer the fill changes too: the edge going a shade stronger alone could not be seen (user, 2026-11-22).
 */
export const PILL_LINK =
  "inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-background px-2.5 text-xs font-semibold whitespace-nowrap text-foreground shadow-tile transition-[background-color,box-shadow,scale] outline-none hover:bg-muted hover:shadow-tile-hover focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]";

/**
 * The arrow of a pill. Its drawing is 6px wide in a 14px box, so 4px of the box's own blank goes back on each side:
 * without that the arrow floated away from the words and the pill looked heavier on the right (user, 2026-11-22).
 * The pill takes `pr-2` with it: the arrow's side then reads 9px against the words' 10px.
 */
export function PillArrow() {
  return <ChevronRight className="-mx-1 size-3.5 text-muted-foreground" aria-hidden="true" />;
}

/** "더 보기 ›": opens NEXON's own list in a new tab. */
export function MoreLink({ href, className }: { href: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn(PILL_LINK, "pr-2", className)}>
      더 보기
      <PillArrow />
    </a>
  );
}
