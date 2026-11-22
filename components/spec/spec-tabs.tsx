import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "person", label: "개인", href: "/spec" },
  { id: "guild", label: "길드", href: "/spec?tab=guild" },
] as const;

/** 개인 · 길드 (user, 2026-11-19): two views of one page, picked by the address. */
export function SpecTabs({ on }: { on: (typeof TABS)[number]["id"] }) {
  return (
    <nav aria-label="검색 종류" className="grid w-[200px] shrink-0 grid-cols-2 gap-0.5 rounded-xl bg-muted p-1">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={on === t.id ? "page" : undefined}
          className={cn(
            // The 1px transparent border is the chosen tab's edge in forced-colors mode, where shadows are removed.
            "flex h-9 items-center justify-center rounded-lg border border-transparent text-sm transition-[background-color,color,box-shadow,scale] active:scale-[0.96]",
            on === t.id ? "bg-card font-bold text-primary-text shadow-tile" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
