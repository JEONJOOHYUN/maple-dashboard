"use client";

import { lazy, Suspense } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Menus of a long list stay under their field, shorter and scrolling when the room below runs out: by default they
 * flipped above it once the list was taller than that room (user, 2026-11-14).
 */
export const BELOW = { side: "none" } as const;
/** The arrow of a menu button or a select. Its glyph has 3.5px of air inside its box, so the box sits 6px in for the glyph to stand 10px in like the text. */
export const MENU_ARROW = "pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-muted-foreground";
/** A radio value of "" reads as no value, so an empty choice goes in as this. */
export const NONE = "\u0000none";

export type MenuSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  menuClassName?: string;
};

// The menu itself (Base UI Menu, ~18KB gzip) comes in its own file, fetched when a field first shows: a page whose
// only menu is this (기댓값 어빌리티) does not carry it on first load. Meanwhile the same field stands in its place.
const Menu = lazy(() => import("@/components/ui/menu-select-menu"));

/**
 * Pick one from a list, in the site's own menu: the browser's list box ignores the theme and, long, runs down the
 * screen (admin dictionary, 77 parts — user 2026-11-25). A filter (one with a "" = everything option) gets the orange
 * edge while it narrows, like 이벤트. Same look as the bordered fields: 32px tall, 40px to the finger.
 */
export function MenuSelect(props: MenuSelectProps) {
  return (
    <Suspense
      fallback={
        // Out of reach until the menu comes: pressed or focused now, it would ignore the press and lose the focus.
        <button type="button" disabled aria-busy="true" {...fieldProps(props)}>
          <FieldFace {...props} />
        </button>
      }
    >
      <Menu {...props} />
    </Suspense>
  );
}

const shownOf = ({ value, options }: MenuSelectProps) => options.find((o) => o.value === value) ?? options[0];

/** The field button's look and name. The name carries the pick, as a select's did: "부위, 모든 부위". */
export function fieldProps(props: MenuSelectProps) {
  const { label, value, options, className } = props;
  return {
    "aria-label": `${label}, ${shownOf(props)?.label ?? ""}`,
    className: cn(
      "relative inline-flex h-8 min-w-0 items-center rounded-md border border-border bg-background pr-8 pl-2.5 text-left text-[13px] text-foreground outline-none after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
      value !== "" && options.some((o) => o.value === "") && "border-primary/60 font-semibold",
      className
    ),
  };
}

/**
 * What the field shows. Every label sits unseen under the picked one, so the width holds whatever is picked: the
 * longest by count is not always the widest ("+20%" against "+15%" in the Maple digits).
 */
export function FieldFace(props: MenuSelectProps) {
  return (
    <>
      <span className="grid min-w-0 *:col-start-1 *:row-start-1">
        <span aria-hidden="true" className="invisible flex flex-col overflow-hidden font-semibold">
          {props.options.map((o) => (
            <span key={o.value} className="h-0 truncate">
              {o.label}
            </span>
          ))}
        </span>
        <span className="truncate">{shownOf(props)?.label}</span>
      </span>
      <ChevronDown className={MENU_ARROW} aria-hidden="true" />
    </>
  );
}
