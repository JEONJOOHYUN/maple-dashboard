import { Arc } from "loading-dev";
import { cn } from "@/lib/utils";

/**
 * The one waiting mark of the site (user, 2026-11-21): every place that waits shows this, in the colour of the text
 * around it. It stops for people who asked for less motion (the library does that itself). `size` is in px.
 */
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex shrink-0", className)}>
      <Arc size={size} />
    </span>
  );
}
