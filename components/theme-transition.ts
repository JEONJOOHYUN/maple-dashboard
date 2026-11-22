"use client";

import { flushSync } from "react-dom";

/** The switch in progress: a second press during it starts its own, and only the latest one cleans up after itself. */
let current: ViewTransition | null = null;
/** The frame that lets transitions back in after an instant switch; a second press restarts the wait. */
let settle = 0;

/**
 * Light ↔ dark (components/theme-toggle.tsx). Every colour changes in the same frame (globals.css `theme-switching`),
 * and where the browser has view transitions the change is one motion from the toggle: the light page is a circle that
 * spreads out of the button going light and is gathered back into it going dark, under a warm light from the button
 * (globals.css `theme-vt`, `theme-glow`). With reduced motion, or in a browser without them, it is instant.
 * `apply` sets the theme's state; the page's class is set here as well, so the browser's picture of the new page is
 * surely in the new colours.
 */
export function switchTheme(button: HTMLElement, next: "light" | "dark", apply: () => void) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  if (typeof document.startViewTransition !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    apply();
    // Two frames: the new colours are drawn with nothing fading, then hover and press ease again.
    cancelAnimationFrame(settle);
    settle = requestAnimationFrame(() => {
      settle = requestAnimationFrame(() => {
        if (!current) root.classList.remove("theme-switching");
      });
    });
    return;
  }

  const box = button.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const toLight = next === "light";
  root.style.setProperty("--theme-x", `${x}px`);
  root.style.setProperty("--theme-y", `${y}px`);
  root.style.setProperty("--theme-r", toLight ? "0px" : `${far}px`);
  root.classList.remove("theme-vt-up", "theme-vt-down");
  root.classList.add("theme-vt", toLight ? "theme-vt-up" : "theme-vt-down");

  let glow: HTMLDivElement | undefined;
  const transition = document.startViewTransition(() => {
    flushSync(apply);
    root.classList.remove("light", "dark");
    root.classList.add(next);
    root.style.colorScheme = next;
    // Part of the new page only, so it lights what is coming in (and, going dark, the dark around the closing circle).
    glow = document.createElement("div");
    glow.className = "theme-glow";
    glow.setAttribute("aria-hidden", "true");
    document.body.append(glow);
  });
  current = transition;
  transition.ready
    .then(() => {
      // The radius lives on the pair of pictures, so the circle and the page it uncovers move as one. It holds its end
      // value (`forwards`, and the inline value too): let go of, it fell back to the start for the frame or two before
      // the browser ends the transition, and the old theme flashed at the very end (user, 2026-11-22).
      const end = toLight ? `${far}px` : "0px";
      root.animate(
        { "--theme-r": [toLight ? "0px" : `${far}px`, end] },
        { duration: 600, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards", pseudoElement: "::view-transition-image-pair(root)" },
      );
      root.style.setProperty("--theme-r", end);
      // The light swells and fades within the same 600ms, so nothing of it is left when the transition ends.
      glow?.animate(
        [{ opacity: 0, easing: "ease-in-out" }, { opacity: 1, offset: 0.4, easing: "ease-in-out" }, { opacity: 0 }],
        { duration: 600 },
      );
    })
    .catch(() => {});
  transition.finished
    .finally(() => {
      glow?.remove();
      if (current !== transition) return;
      current = null;
      root.classList.remove("theme-switching", "theme-vt", "theme-vt-up", "theme-vt-down");
      for (const name of ["--theme-x", "--theme-y", "--theme-r"]) root.style.removeProperty(name);
    })
    .catch(() => {});
}
