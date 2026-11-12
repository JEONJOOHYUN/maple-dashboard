import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Page title block used at the top of every tool page.
 * `pinAside` = keep `aside` on the title's line at every width (a small control such as a menu button); without it a
 * wide aside drops under the title on phones.
 */
export function PageHeader({
  title,
  description,
  aside,
  pinAside,
}: {
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  pinAside?: boolean;
}) {
  return (
    <div className={cn("flex justify-between gap-3", pinAside ? "items-start" : "flex-wrap items-end")}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="font-heading text-[22px] leading-tight font-bold lg:text-[26px]">{title}</h1>
        {description && <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {aside}
    </div>
  );
}
