"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { findActive, navGroups } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const active = findActive(pathname);
  const isHome = pathname === "/";
  const crumb = isHome
    ? "홈"
    : active
      ? `${active.group.label} · ${active.item.label}`
      : pathname === "/privacy"
        ? "개인정보처리방침"
        : "";

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 lg:px-8 lg:py-3.5">
      <Brand compact className="lg:hidden" />
      <span className="hidden text-[13px] text-muted-foreground lg:inline">{crumb}</span>

      {/* Login button stays hidden until member features ship (kept on the `members` branch). */}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>

      {/* Mobile: group tabs, then the tools inside the chosen group. */}
      <nav aria-label="메뉴" className="flex w-full flex-col gap-1 lg:hidden">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pt-1 [scrollbar-width:none]">
          <GroupTab href="/" label="홈" active={isHome} />
          {navGroups.map((group) => (
            <GroupTab
              key={group.id}
              href={group.items[0].href}
              label={group.label}
              active={active?.group.id === group.id}
            />
          ))}
        </div>
        {active && active.group.items.length > 1 && (
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none]">
            {active.group.items.map((item) => {
              const on = item.slug === active.item.slug;
              return (
                <Link
                  key={item.slug}
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex h-[30px] shrink-0 items-center rounded-full px-3 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    on ? "bg-primary-soft font-bold text-primary-text" : "text-muted-foreground"
                  )}
                >
                  {item.short}
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </header>
  );
}

function GroupTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-[34px] shrink-0 items-center rounded-lg border px-3.5 text-[13px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground"
      )}
    >
      {label}
    </Link>
  );
}
