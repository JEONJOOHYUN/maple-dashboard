import type { ReactNode } from "react";

/**
 * A dashed card with a bold title and one muted line: nothing searched yet, nothing found, a lookup or a page that
 * failed. `children` go under the two lines (a button, a link).
 * `heading` = the block is the whole page, so its title is the page's <h1>; without it the block sits in a page that
 * already has one.
 */
export function Message({ title, sub, heading = false, children }: { title: string; sub: string; heading?: boolean; children?: ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-1.5 rounded-[1rem] border border-dashed border-border bg-card px-5 py-10 text-center">
      {heading ? (
        <>
          <h1 className="text-[15px] font-bold">{title}</h1>
          <p className="text-[13px] text-muted-foreground">{sub}</p>
        </>
      ) : (
        <>
          <b className="text-[15px] text-balance">{title}</b>
          <span className="text-[13px] text-pretty text-muted-foreground">{sub}</span>
        </>
      )}
      {children}
    </section>
  );
}
