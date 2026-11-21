import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const EASE = "duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";

/**
 * Two icons in one spot (copy → check): when `on` flips, one fades out as the other fades in, each with a little
 * scale and blur, instead of one replacing the other in a single frame. Both stay in the page and only CSS
 * transitions move them, so a second flip half-way just turns the motion round.
 */
export function SwapIcon({ on, from, to, className }: { on: boolean; from: ReactNode; to: ReactNode; className?: string }) {
  const layer = cn("col-start-1 row-start-1 flex transition-[opacity,scale,filter]", EASE);
  const shown = "scale-100 opacity-100 blur-none";
  const hidden = "scale-25 opacity-0 blur-xs";
  return (
    <span aria-hidden="true" className={cn("inline-grid shrink-0", className)}>
      <span className={cn(layer, on ? hidden : shown)}>{from}</span>
      <span className={cn(layer, on ? shown : hidden)}>{to}</span>
    </span>
  );
}

/**
 * A button's whole content in two states (icon + words): "금액 복사" ↔ "복사됨". The two sit on top of each
 * other, so the button is as wide as the wider one from the start and never jumps when the words change (user,
 * 2026-11-22: the icon moved softly but the words and the width snapped). The words fade and blur over 0.3s; the icons inside
 * also scale. Only the state on show is read out.
 */
export function SwapLabel({ on, from, to, className }: { on: boolean; from: ReactNode; to: ReactNode; className?: string }) {
  const layer = cn(
    "col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-[opacity,filter] [&_svg]:shrink-0 [&_svg]:transition-[scale]",
    EASE,
    "[&_svg]:duration-300 [&_svg]:ease-[cubic-bezier(0.2,0,0,1)]"
  );
  const shown = "opacity-100 blur-none [&_svg]:scale-100";
  const hidden = "opacity-0 blur-xs [&_svg]:scale-25";
  return (
    <span className={cn("inline-grid", className)}>
      <span aria-hidden={on} className={cn(layer, on ? hidden : shown)}>
        {from}
      </span>
      <span aria-hidden={!on} className={cn(layer, on ? shown : hidden)}>
        {to}
      </span>
    </span>
  );
}
