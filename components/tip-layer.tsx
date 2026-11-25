"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// The site's one hover bubble. An element asks for it with `data-tip` (lines split by "\n"; with more than one, the
// first is the heading). One listener and one bubble for the whole page, instead of a tooltip component per row:
// tables here run to hundreds of rows. The bubble only comes when it adds something — when the words are not on the
// screen already, or are cut short there. `data-tip-parent` = judge the parent instead (a button laid over a card
// whose name is cut below it). Touch gets nothing, as with the browser's own title box. Words that are not on the
// screen also go to screen readers through `extraTip` (lib/tip.ts).

const WAIT = 500;
/** Moving from one bubble to the next within this long opens the next at once. */
const STILL_OPEN = 300;
const GAP = 8;
const EDGE = 8;

type Tip = { id: number; lines: string[]; rect: DOMRect };

const flat = (s: string) => s.replace(/\s+/g, " ").trim();

function worth(el: HTMLElement, text: string): boolean {
  const scope = el.hasAttribute("data-tip-parent") && el.parentElement ? el.parentElement : el;
  const want = flat(text);
  if (!flat(scope.textContent ?? "").includes(want)) return true;
  // The same words are on the screen: only when an element holding them is cut, on one line or after a few.
  for (const node of [scope, ...scope.querySelectorAll<HTMLElement>("*")]) {
    if (node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1) continue;
    const own = flat(node.textContent ?? "");
    if (own && want.includes(own)) return true;
  }
  return false;
}

export function TipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let timer = 0;
    let current: HTMLElement | null = null;
    let shown = false;
    let closedAt = -Infinity;
    let id = 0;

    const hide = () => {
      clearTimeout(timer);
      current = null;
      if (shown) {
        shown = false;
        closedAt = performance.now();
        setTip(null);
      }
    };
    const show = (el: HTMLElement) => {
      const text = el.dataset.tip?.trim();
      if (!text || !worth(el, text)) return;
      current = el;
      const open = () => {
        if (current !== el || !el.isConnected) return;
        shown = true;
        setTip({ id: ++id, lines: text.split("\n"), rect: el.getBoundingClientRect() });
      };
      if (performance.now() - closedAt < STILL_OPEN) open();
      else timer = window.setTimeout(open, WAIT);
    };
    const target = (node: EventTarget | null) => (node instanceof Element ? node.closest<HTMLElement>("[data-tip]") : null);

    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = target(e.target);
      if (el === current) return;
      hide();
      if (el) show(el);
    };
    const out = (e: PointerEvent) => {
      if (!e.relatedTarget) hide();
    };
    const focusIn = (e: FocusEvent) => {
      const el = target(e.target);
      if (el && el === e.target && el.matches(":focus-visible")) {
        hide();
        show(el);
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    const opts = { capture: true, passive: true } as const;
    document.addEventListener("pointerover", over, opts);
    document.addEventListener("pointerout", out, opts);
    document.addEventListener("pointerdown", hide, opts);
    document.addEventListener("focusin", focusIn, opts);
    document.addEventListener("focusout", hide, opts);
    document.addEventListener("keydown", key, opts);
    window.addEventListener("scroll", hide, opts);
    window.addEventListener("resize", hide, opts);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerover", over, opts);
      document.removeEventListener("pointerout", out, opts);
      document.removeEventListener("pointerdown", hide, opts);
      document.removeEventListener("focusin", focusIn, opts);
      document.removeEventListener("focusout", hide, opts);
      document.removeEventListener("keydown", key, opts);
      window.removeEventListener("scroll", hide, opts);
      window.removeEventListener("resize", hide, opts);
    };
  }, []);

  // Placed before paint: above the element, below it when the top has no room, kept inside the window.
  useLayoutEffect(() => {
    const el = box.current;
    if (!tip || !el) return;
    const { rect } = tip;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const below = rect.top - h - GAP < EDGE;
    const mid = rect.left + rect.width / 2;
    const left = Math.min(Math.max(mid - w / 2, EDGE), window.innerWidth - w - EDGE);
    el.style.left = `${left}px`;
    el.style.top = `${below ? rect.bottom + GAP : rect.top - h - GAP}px`;
    el.dataset.side = below ? "bottom" : "top";
    if (arrow.current) arrow.current.style.left = `${Math.min(Math.max(mid - left, 10), w - 10)}px`;
  }, [tip]);

  if (!tip) return null;
  const many = tip.lines.length > 1;
  return (
    <div
      key={tip.id}
      ref={box}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-50 flex w-max max-w-[min(18rem,calc(100vw-1rem))] flex-col items-start gap-1 rounded-md bg-foreground px-3 py-1.5 text-xs leading-snug text-background transition-[opacity,scale] duration-150 ease-out starting:scale-95 starting:opacity-0 data-[side=bottom]:origin-top data-[side=top]:origin-bottom"
    >
      {tip.lines.map((line, i) => (
        <span key={i} className={many ? (i === 0 ? "font-bold" : "opacity-80") : undefined}>
          {/* Lines break between " · " items, not inside them. */}
          {line.split(" · ").map((piece, j, all) => (
            <span key={j}>
              <span className="inline-block max-w-full break-keep">
                {piece}
                {j < all.length - 1 && " ·"}
              </span>
              {j < all.length - 1 && " "}
            </span>
          ))}
        </span>
      ))}
      <span ref={arrow} className="absolute size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-foreground in-data-[side=bottom]:-top-1 in-data-[side=top]:-bottom-1" />
    </div>
  );
}
