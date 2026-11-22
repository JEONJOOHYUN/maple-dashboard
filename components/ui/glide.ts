"use client";

import { useLayoutEffect, useRef, useState } from "react";

const OPEN_MS = 300;
const CLOSE_MS = 200;
/** Leaves without a jolt and settles long: the curve the design skill gives where there is no spring. */
const EASE = "cubic-bezier(0.2, 0, 0, 1)";

const rest = (el: HTMLElement | null) => {
  if (!el) return;
  el.style.height = "";
  el.style.overflowY = "";
  el.style.transition = "";
};

/**
 * useReveal for rows that open inside a box of other rows ("더 보기"), with the box's height following them: the rows
 * faded in softly, but the box took their room in one frame, so the button under it jumped 340px and, closing, waited
 * and jumped back (user, 2026-11-22). Here the box grows and shrinks over the same time as the rows fade, cutting what
 * is below its edge.
 *
 * `boxRef` goes on the element whose height changes, `attrs` and the `reveal-row` class on each opened row. Call `mark`
 * in the click handler, before the state changes: it reads the heights to start from, so a second click half-way
 * starts from where the box is. `frameRef` is optional, for an element around the box that ends as tall as it began (the
 * room is kept elsewhere in it): pass `mark(true)` and it holds its height meanwhile.
 * Only a CSS transition moves the height. With reduced motion nothing moves and the rows just come and go.
 */
export function useGlide(open: boolean) {
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLElement>(null);
  const before = useRef<{ box: number; frame: number | null } | null>(null);

  const mark = (holdFrame = false) => {
    if (!boxRef.current) return;
    before.current = {
      box: boxRef.current.getBoundingClientRect().height,
      frame: holdFrame && frameRef.current ? frameRef.current.getBoundingClientRect().height : null,
    };
  };

  useLayoutEffect(() => {
    const el = boxRef.current;
    const from = before.current;
    before.current = null;
    const ms = open ? OPEN_MS : CLOSE_MS;
    if (el && from && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.transition = "none";
      el.style.height = "";
      // Where it ends: its own height, less the rows on their way out (they stay in the page until they have faded).
      let to = el.getBoundingClientRect().height;
      if (!open) for (const row of el.querySelectorAll('[data-open="false"]')) to -= row.getBoundingClientRect().height;
      el.style.overflowY = "clip";
      el.style.height = `${from.box}px`;
      if (frameRef.current && from.frame !== null) frameRef.current.style.height = `${from.frame}px`;
      // The starting height has to be laid out before the transition is given something to move to.
      el.getBoundingClientRect();
      el.style.transition = `height ${ms}ms ${EASE}`;
      el.style.height = `${to}px`;
    }
    // By the clock, like useReveal: no transition event comes with reduced motion or a hidden parent.
    const timer = setTimeout(() => {
      if (open) {
        rest(boxRef.current);
        rest(frameRef.current);
      } else setShown(false);
    }, ms + 40);
    return () => clearTimeout(timer);
  }, [open]);

  // Closed: the rows have just left the page, so the box's own height is the one it was moved to.
  useLayoutEffect(() => {
    if (shown) return;
    rest(boxRef.current);
    rest(frameRef.current);
  }, [shown]);

  return { shown, attrs: { "data-open": open, inert: !open } as const, boxRef, frameRef, mark };
}
