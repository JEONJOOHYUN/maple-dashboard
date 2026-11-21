"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A little over the 0.15s fade of the `reveal` utility in globals.css. */
const LEAVE_MS = 200;

/**
 * A panel under a row that opens and closes. Closing, it fades and moves a few pixels before it leaves the page,
 * instead of vanishing in one frame; opening is the same motion back. Only CSS transitions move it, so closing
 * half-way through opening just turns round.
 * It is removed by the clock, not by a transition event: with reduced motion (no transition at all) or a hidden parent
 * no such event comes, and a panel left mounted would keep its inputs' old state for the next time it opens.
 * The children stay on show while it closes: they must still make sense with `open` false.
 */
export function Reveal({ open, className, ...props }: ComponentProps<"div"> & { open: boolean }) {
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  useEffect(() => {
    if (open || !shown) return;
    const timer = setTimeout(() => setShown(false), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [open, shown]);
  if (!shown) return null;
  return <div {...props} data-open={open} inert={!open} className={cn("reveal", className)} />;
}
