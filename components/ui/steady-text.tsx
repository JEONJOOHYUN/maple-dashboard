import type { ReactNode } from "react";

/**
 * A label that turns bold when its button is picked, without the button changing width: the bold copy is always
 * there, unseen, and holds the width (a picked tab used to push its neighbours a pixel or two).
 */
export function SteadyText({ children }: { children: ReactNode }) {
  return (
    <span className="inline-grid justify-items-center">
      <span className="col-start-1 row-start-1">{children}</span>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-bold">
        {children}
      </span>
    </span>
  );
}
