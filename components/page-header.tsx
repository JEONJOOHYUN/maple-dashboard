import type { ReactNode } from "react";

/** Page title block used at the top of every tool page. */
export function PageHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-[22px] leading-tight font-bold lg:text-[26px]">{title}</h1>
        {description && <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {aside}
    </div>
  );
}
