"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import { NavIcon } from "@/components/nav-icon";
import { Badge } from "@/components/ui/badge";
import { homeItem, navGroups, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 w-full shrink-0 items-center gap-2.5 rounded-xl px-2.5 text-sm whitespace-nowrap transition-[background-color,color,scale] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]",
        // The page you are on is a piece of the sheet lifted onto the menu: the sheet colour and its ring.
        active
          ? "bg-sidebar-accent font-bold text-sidebar-accent-foreground shadow-tile"
          : "font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
      )}
    >
      <NavIcon slug={item.slug} icon={item.icon} className="size-[22px]" />
      {item.label}
      {!item.ready && (
        <Badge variant="secondary" className="ml-auto h-[18px] px-1.5 text-[10px] font-medium text-muted-foreground">
          준비 중
        </Badge>
      )}
    </Link>
  );
}

/** Desktop left menu (lg and up). Mobile uses the tab rows in SiteHeader. */
export function SideNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      aria-label="메뉴"
      className="sticky top-3 hidden h-[calc(100dvh-1.5rem)] w-54 shrink-0 flex-col gap-0.5 overflow-y-auto px-2 py-2.5 text-sidebar-foreground [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] lg:flex"
    >
      <Brand className="mb-2.5 h-10 shrink-0 px-2.5" />
      <SideLink item={homeItem} active={isActive("/")} />
      {navGroups.map((group) => (
        <div key={group.id} className="flex shrink-0 flex-col gap-0.5">
          <p className="mx-2.5 mt-3.5 mb-1 text-xs font-semibold text-muted-foreground">
            {group.label}
          </p>
          {group.items.map((item) => (
            <SideLink key={item.slug} item={item} active={isActive(item.href)} />
          ))}
        </div>
      ))}
      {/* Nexon IP guide · Open API notices, always in the same place on desktop (mobile: end of the page). */}
      <p className="mt-auto px-2.5 pt-6 text-[11px] leading-relaxed text-muted-foreground">
        MapleStory © NEXON Korea
        <br />
        Data based on NEXON Open API
        <br />
        넥슨과 무관한 비공식 팬 사이트
      </p>
    </nav>
  );
}
