"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A little over the 0.15s exit of the `reveal` · `reveal-row` utilities in globals.css. */
const LEAVE_MS = 200;

/**
 * Something that opens and closes under a row. Closing, it fades and moves a few pixels before it leaves the page,
 * instead of vanishing in one frame; opening is the same motion back. Only CSS transitions move it, so closing
 * half-way through opening just turns round.
 * `shown` says whether to render at all; `attrs` go on the element together with the `reveal` class (`reveal-row` on a
 * table row).
 * It is removed by the clock, not by a transition event: with reduced motion (no transition at all) or a hidden parent
 * no such event comes, and a panel left mounted would keep its inputs' old state for the next time it opens.
 */
export function useReveal(open: boolean) {
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  useEffect(() => {
    if (open || !shown) return;
    const timer = setTimeout(() => setShown(false), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [open, shown]);
  return { shown, attrs: { "data-open": open, inert: !open } as const };
}

/**
 * useReveal as a <div>. The children shown while it closes are the last ones it had while open, so the caller may
 * pass nothing once it is closed (`{open && …}` inside is fine, and so is state that is cleared on closing).
 */
export function Reveal({ open, className, children, ...props }: ComponentProps<"div"> & { open: boolean }) {
  const { shown, attrs } = useReveal(open);
  const [kept, setKept] = useState<ReactNode>(children);
  // Remember what is on show (a new element every render of the parent: one more render of this, then it settles).
  if (open && kept !== children) setKept(children);
  if (!shown) return null;
  return (
    <div {...props} {...attrs} className={cn("reveal", className)}>
      {open ? children : kept}
    </div>
  );
}
