"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { NewsSlide } from "@/lib/home/news-parse";

/** Seconds a page of pictures stays before the next one comes (user, 2026-11-13: "몇 초마다 옆 이미지로"). */
const EVERY_MS = 4500;

/**
 * NEXON's notice pictures in a row that moves on by itself, a page at a time: two pictures a page, one on a phone —
 * the same for events and the cash shop, which sit side by side (user, 2026-11-13). Every picture is shown in one
 * frame shape (14 : 5) so the two rows are the same height: event pictures (285 × 120) lose a little off the top and
 * bottom, cash shop pictures (443 × 130) a little off the sides. The row is a scroll area with snap points, so a
 * swipe or the arrows move it too. It stands still while the pointer or the focus is on it, and for people who asked for less motion.
 * The pictures are NEXON's own addresses from the Open API, shown as they are (never stored or resized by us).
 */
export function ThumbCarousel({ title, more, slides, empty }: { title: string; more: string; slides: NewsSlide[]; empty: string }) {
  const track = useRef<HTMLUListElement>(null);
  // The pointer and the focus are kept apart: the row stands still while either is on the card. As one flag, the
  // pointer leaving started it again under a focused arrow button (Codex review, 2026-11-13).
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const held = hover || focus;
  const step = useCallback((dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const last = el.scrollWidth - el.clientWidth;
    // One page = what is on screen plus the gap after it, so the row lands on the edge of a picture: by the width
    // alone it stopped a gap short and the picture before showed as a sliver on the left.
    const page = el.clientWidth + (parseFloat(getComputedStyle(el).columnGap) || 0);
    // Past either end it goes round to the other one.
    if (dir === 1 && el.scrollLeft >= last - 4) el.scrollTo({ left: 0 });
    else if (dir === -1 && el.scrollLeft <= 4) el.scrollTo({ left: last });
    else el.scrollTo({ left: Math.round((el.scrollLeft + dir * page) / page) * page });
  }, []);
  useEffect(() => {
    if (held || slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (!document.hidden) step(1);
    }, EVERY_MS);
    return () => window.clearInterval(id);
  }, [held, slides.length, step]);

  const arrow = "flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card px-4 pt-2.5 pb-4 lg:px-[18px]"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocusCapture={() => setFocus(true)}
      onBlurCapture={() => setFocus(false)}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">{title}</h2>
        <span className="flex items-center gap-0.5">
          {slides.length > 1 && (
            <>
              <button type="button" aria-label={`${title} 이전`} onClick={() => step(-1)} className={arrow}>
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button type="button" aria-label={`${title} 다음`} onClick={() => step(1)} className={arrow}>
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </>
          )}
          <a href={more} target="_blank" rel="noreferrer" className="ml-1.5 rounded-sm py-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            더 보기 →
          </a>
        </span>
      </div>
      {slides.length === 0 ? (
        <p className="rounded-md bg-muted px-4 py-8 text-center text-[13px] text-muted-foreground">{empty}</p>
      ) : (
        <ul ref={track} className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden">
          {slides.map((slide) => (
            <li key={slide.id} className="min-w-0 shrink-0 basis-full snap-start sm:basis-[calc((100%-12px)/2)]">
              <a href={slide.url} target="_blank" rel="noreferrer" className="group flex flex-col gap-1.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                {/* eslint-disable-next-line @next/next/no-img-element -- NEXON's notice picture, shown as is (never stored or resized by us) */}
                <img src={slide.img} alt="" loading="lazy" className="aspect-[14/5] w-full rounded-md bg-muted object-cover" />
                <span className="flex items-center justify-between gap-2">
                  <b className="min-w-0 truncate text-[13.5px] group-hover:text-primary-text">{slide.title}</b>
                  {slide.badge && <span className="shrink-0 rounded bg-primary-soft px-1.5 text-[11px] leading-[18px] font-bold whitespace-nowrap text-primary-text">{slide.badge}</span>}
                </span>
                {slide.meta && <span className="-mt-1 text-xs text-muted-foreground">{slide.meta}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
