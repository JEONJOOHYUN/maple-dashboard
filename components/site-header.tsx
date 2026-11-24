"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { syncMemberHint } from "@/lib/auth/member-hint";
import { findActive, navGroups } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Pages outside the menu. */
const PLAIN_CRUMBS: Record<string, string> = { "/privacy": "개인정보처리방침", "/login": "로그인", "/me": "내 정보" };

export function SiteHeader() {
  const pathname = usePathname();
  const active = findActive(pathname);
  const isHome = pathname === "/";
  const crumb = isHome ? "홈" : active ? `${active.group.label} · ${active.item.label}` : (PLAIN_CRUMBS[pathname] ?? "");

  // Signing out moves here without a page load: the mark set by the inline script is read again.
  useEffect(() => {
    syncMemberHint();
  }, [pathname]);

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 lg:px-8 lg:py-3.5">
      <Brand compact className="lg:hidden" />
      <span className="hidden text-[13px] font-medium text-muted-foreground lg:inline">{crumb}</span>

      {/* Both marks are in the page; CSS shows the one that fits (app/globals.css .when-guest / .when-member). */}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        {pathname !== "/login" && (
          <Link
            href="/login"
            className="when-guest flex h-10 items-center rounded-xl bg-card px-3.5 text-[13px] font-semibold whitespace-nowrap text-foreground transition-[background-color,scale] outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
          >
            로그인
          </Link>
        )}
        <Link
          href="/me"
          aria-label="내 정보"
          aria-current={pathname === "/me" ? "page" : undefined}
          data-clarity-mask="true"
          className="when-member member-letter flex size-10 items-center justify-center rounded-full bg-primary-soft text-[15px] font-bold text-primary-text inset-ring inset-ring-primary transition-[background-color,scale] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
        />
      </div>

      {/* Mobile: group tabs, then the tools inside the chosen group. */}
      <nav aria-label="메뉴" className="flex w-full flex-col gap-2 lg:hidden">
        {/* A sideways scroll row cuts top and bottom too: room inside it for the tabs' shadow (6px under them) and
            focus ring, given back outside by the negative margin so the rows stay where they were. */}
        <div className="-mx-4 -mb-1.5 flex gap-1.5 overflow-x-auto px-4 pt-1 pb-1.5 [scrollbar-width:none]">
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
          <div className="-mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
            {active.group.items.map((item) => {
              const on = item.slug === active.item.slug;
              return (
                <Link
                  key={item.slug}
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-[background-color,color,scale] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]",
                    on ? "bg-primary-soft font-bold text-primary-text" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.short}
                  {!item.ready && (
                    <Badge variant="secondary" className="h-[18px] px-1.5 text-[10px] font-medium text-muted-foreground">
                      준비 중
                    </Badge>
                  )}
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
        // The 1px transparent border is the tab's edge in forced-colors mode (shadows are removed there); the side
        // padding is 1px less for it.
        "flex h-9 shrink-0 items-center rounded-full border border-transparent px-[13px] text-[13px] font-semibold whitespace-nowrap transition-[background-color,color,scale] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]",
        active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground shadow-tile hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}
