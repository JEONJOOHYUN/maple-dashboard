"use client";

import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import { NavLink } from "@/components/intent-link";
import { NavIcon } from "@/components/nav-icon";
import { Badge } from "@/components/ui/badge";
import { homeItem, navGroups, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <NavLink
      item={item}
      aria-current={active ? "page" : undefined}
      className={cn(
        // after: the press area fills the 4px between two links (36px → 40px), never over a neighbour.
        "relative flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-sm whitespace-nowrap transition-[background-color,color,scale] outline-none after:absolute after:inset-x-0 after:-inset-y-0.5 active:scale-[0.96] focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
          : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <NavIcon slug={item.slug} icon={item.icon} className="size-[22px]" />
      {item.label}
      {!item.ready && (
        <Badge variant="outline" className="ml-auto h-[18px] px-1.5 text-[10px] font-medium text-muted-foreground">
          준비 중
        </Badge>
      )}
    </NavLink>
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
      className="sticky top-0 hidden h-dvh w-58 shrink-0 flex-col gap-1 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3.5 py-[22px] text-sidebar-foreground [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] lg:flex"
    >
      <Brand className="mb-[18px] px-2" />
      <SideLink item={homeItem} active={isActive("/")} />
      {navGroups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          <p className="mx-2.5 mt-[18px] mb-1 text-xs font-semibold text-muted-foreground">
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
