"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { LEAVE_MS, useSelfGlide } from "@/components/ui/glide";
import { cn } from "@/lib/utils";

/** A little over the 0.15s exit of the `reveal` · `reveal-row` utilities in globals.css. */
const FADE_MS = 200;

/**
 * Something that opens and closes under a row. Closing, it fades and moves a few pixels before it leaves the page,
 * instead of vanishing in one frame; opening is the same motion back. Only CSS transitions move it, so closing
 * half-way through opening just turns round.
 * `shown` says whether to render at all; `attrs` go on the element together with the `reveal` class (`reveal-row` on a
 * table row). `leaveMs` = how long it stays after closing: longer when its room shrinks too (glide.ts `LEAVE_MS`).
 * It is removed by the clock, not by a transition event: with reduced motion (no transition at all) or a hidden parent
 * no such event comes, and a panel left mounted would keep its inputs' old state for the next time it opens.
 */
export function useReveal(open: boolean, leaveMs = FADE_MS) {
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  useEffect(() => {
    if (open || !shown) return;
    const timer = setTimeout(() => setShown(false), leaveMs);
    return () => clearTimeout(timer);
  }, [open, shown, leaveMs]);
  return { shown, attrs: { "data-open": open, inert: !open } as const };
}

/**
 * useReveal as a <div> whose room grows and shrinks with it (useSelfGlide), so what is under it slides. The children
 * shown while it closes are the last ones it had while open, so the caller may pass nothing once it is closed
 * (`{open && …}` inside is fine, and so is state that is cleared on closing).
 */
export function Reveal({ open, className, children, ...props }: ComponentProps<"div"> & { open: boolean }) {
  const { shown, attrs } = useReveal(open, LEAVE_MS);
  const ref = useRef<HTMLDivElement>(null);
  useSelfGlide(ref, open);
  const [kept, setKept] = useState<ReactNode>(children);
  // Remember what is on show (a new element every render of the parent: one more render of this, then it settles).
  if (open && kept !== children) setKept(children);
  if (!shown) return null;
  return (
    <div ref={ref} {...props} {...attrs} className={cn("reveal", className)}>
      {open ? children : kept}
    </div>
  );
}
