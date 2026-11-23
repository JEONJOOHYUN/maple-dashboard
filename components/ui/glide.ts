"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

export const OPEN_MS = 300;
export const CLOSE_MS = 200;
/** Leaves without a jolt and settles long: the curve the design skill gives where there is no spring. */
export const EASE = "cubic-bezier(0.2, 0, 0, 1)";
/** How long something closed stays in the page: its close and a little more, so it leaves at rest. */
export const LEAVE_MS = CLOSE_MS + 40;

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const px = (v: string) => parseFloat(v) || 0;

/** The room an element takes in its column: height, padding and margins, in px. */
type Room = { height: number; paddingTop: number; paddingBottom: number; marginTop: number; marginBottom: number };
const roomOf = (el: HTMLElement): Room => {
  const s = getComputedStyle(el);
  return {
    height: el.getBoundingClientRect().height,
    paddingTop: px(s.paddingTop),
    paddingBottom: px(s.paddingBottom),
    marginTop: px(s.marginTop),
    marginBottom: px(s.marginBottom),
  };
};
/**
 * No room at all. In a flex or one-track grid column the parent puts a gap beside it too: a negative margin takes that
 * back, on the side where the neighbour is.
 */
const noRoom = (el: HTMLElement): Room => {
  const parent = el.parentElement;
  const s = parent ? getComputedStyle(parent) : null;
  const column =
    !!s &&
    ((s.display.endsWith("flex") && s.flexDirection.startsWith("column")) ||
      (s.display.endsWith("grid") && s.gridTemplateColumns.trim().split(/\s+/).length === 1));
  const taken = (c: Element | null) => !!c && getComputedStyle(c).display !== "none" && !/absolute|fixed/.test(getComputedStyle(c).position);
  const gap = column && s && ([...parent!.children].some((c) => c !== el && taken(c))) ? px(s.rowGap) : 0;
  const before = taken(el.previousElementSibling);
  return { height: 0, paddingTop: 0, paddingBottom: 0, marginTop: before ? -gap : 0, marginBottom: before ? 0 : -gap };
};
const frame = (r: Room) => ({
  height: `${r.height}px`,
  paddingTop: `${r.paddingTop}px`,
  paddingBottom: `${r.paddingBottom}px`,
  marginTop: `${r.marginTop}px`,
  marginBottom: `${r.marginBottom}px`,
});

/**
 * useReveal's element taking its room gradually: height, padding and margins grow from nothing over the fade, and
 * shrink back when it closes, so what is under it slides instead of jumping (user, 2026-11-23: every panel that opens
 * and closes, like "더 보기"). The gap its flex or grid column puts beside it comes and goes the same way.
 * Web animations, not transitions: the element's own fade (the `reveal` utility) keeps its transitions untouched.
 * Only a change of `open` moves it, never the first render; closing half-way through opening turns round from where it
 * is. Pass useReveal `LEAVE_MS`, so the element is still in the page until it has shrunk. With reduced motion nothing
 * moves.
 */
export function useSelfGlide(ref: RefObject<HTMLElement | null>, open: boolean) {
  const was = useRef(open);
  const moving = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    if (was.current === open) return;
    was.current = open;
    const el = ref.current;
    if (!el || still()) return;
    const before = moving.current?.effect instanceof KeyframeEffect && moving.current.effect.target === el ? moving.current : null;
    // From where it is if it was moving or is about to close, from nothing if it has just been put in the page.
    const from = before || !open ? roomOf(el) : noRoom(el);
    before?.cancel();
    const to = open ? roomOf(el) : noRoom(el);
    el.style.overflowY = "clip";
    const a = el.animate([frame(from), frame(to)], { duration: open ? OPEN_MS : CLOSE_MS, easing: EASE, fill: open ? "none" : "forwards" });
    moving.current = a;
    if (open)
      a.onfinish = () => {
        if (moving.current === a) el.style.overflowY = "";
      };
  }, [open, ref]);
}

/**
 * Rows that open under a row of a table. A <tr> takes no height but its content's, so the rows after them slide:
 * opening, they start where they were and move down off the new rows (which fade in under them); closing, they move
 * up over the leaving rows, which are dropped from the page as the slide ends. The box around the table grows or
 * shrinks to match, so what is under the table slides too. `open` / `shown` as from useReveal (with `LEAVE_MS`);
 * `rows` gives the opening rows once they are in the page; `byHand` says whether this change came from the line's own
 * button (asked once per change), so opening many lines at once or by a search just shows them.
 * One table moves for one line at a time: another line pressed meanwhile first ends the moving one (a close cut short
 * takes its rows out of the layout at once), then measures. Everything is put back when the line closes, rests or
 * leaves the page.
 */
export function useRowGlide(open: boolean, shown: boolean, rows: () => HTMLElement[], byHand: () => boolean) {
  const was = useRef(open);
  // `leaving`: the rows of a close, still in the page until useReveal drops them.
  const moving = useRef<{ anims: Animation[]; lifted: HTMLElement[]; box: HTMLElement; leaving: HTMLElement[] | null } | null>(null);
  // The same functions for the life of the line, so the table can name the line moving it. `halt` puts back what
  // this line set; `handOver` is for another line taking the table: a close it cuts short ends at once (its rows out
  // of the layout now, not when React drops them), so the other line measures the table as it will be.
  const [glide] = useState(() => {
    const g = {
      halt: () => {
        const m = moving.current;
        if (!m) return;
        for (const a of m.anims) a.cancel();
        for (const r of m.lifted) {
          r.style.position = "";
          r.style.zIndex = "";
        }
        m.box.style.overflowY = "";
        if (tableGlides.get(m.box) === g.handOver) tableGlides.delete(m.box);
        moving.current = null;
      },
      handOver: () => {
        for (const r of moving.current?.leaving ?? []) r.style.display = "none";
        g.halt();
      },
    };
    return g;
  });
  const stop = glide.halt;
  useLayoutEffect(() => {
    if (was.current === open) return;
    was.current = open;
    const hand = byHand();
    const mine = rows();
    // Taken out by another line's handOver, then opened again before they left.
    if (open) for (const r of mine) r.style.display = "";
    const last = mine[mine.length - 1];
    const box = last?.closest("table")?.parentElement;
    if (!hand || !last || !box || still()) return stop();
    const other = tableGlides.get(box);
    if (other && other !== glide.handOver) other();
    const size = mine.reduce((sum, r) => sum + r.getBoundingClientRect().height, 0);
    const after: HTMLElement[] = [];
    for (let r = last.nextElementSibling; r; r = r.nextElementSibling) after.push(r as HTMLElement);
    // Where things are now, mid-way if they were moving.
    const shift = (r: HTMLElement) => {
      const t = getComputedStyle(r).transform;
      return t && t !== "none" ? new DOMMatrixReadOnly(t).m42 : 0;
    };
    const wasMoving = !!moving.current;
    const fromShift = after.map((r) => (wasMoving ? shift(r) : open ? -size : 0));
    const fromHeight = wasMoving ? box.getBoundingClientRect().height : box.getBoundingClientRect().height - (open ? size : 0);
    stop();
    const full = box.getBoundingClientRect().height;
    const ms = open ? OPEN_MS : CLOSE_MS;
    const fill: FillMode = open ? "none" : "forwards";
    box.style.overflowY = "hidden";
    const anims = [box.animate([{ height: `${fromHeight}px` }, { height: `${open ? full : full - size}px` }], { duration: ms, easing: EASE, fill })];
    // Above the rows they cover, sticky first cells included.
    after.forEach((r, i) => {
      r.style.position = "relative";
      r.style.zIndex = "2";
      anims.push(r.animate([{ transform: `translateY(${fromShift[i]}px)` }, { transform: `translateY(${open ? 0 : -size}px)` }], { duration: ms, easing: EASE, fill }));
    });
    moving.current = { anims, lifted: after, box, leaving: open ? null : mine };
    tableGlides.set(box, glide.handOver);
    if (open)
      anims[0].onfinish = () => {
        if (moving.current?.anims[0] === anims[0]) stop();
      };
    // Only a change of `open` moves anything: `rows` and `byHand` read the page and a ref, not React state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // The rows have left: what was moved over them is where it belongs now.
  useLayoutEffect(() => {
    if (!shown) stop();
  }, [shown, stop]);
  // The line itself leaves (a search or a filter drops the player) while it moves: nothing it set may stay behind.
  useLayoutEffect(() => stop, [stop]);
}

/** The line moving each table's box now (its handOver, useRowGlide): a second one ends it before it starts. */
const tableGlides = new WeakMap<HTMLElement, () => void>();

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
