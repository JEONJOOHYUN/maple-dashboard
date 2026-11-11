"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { homeItem, navGroups, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-[9px] text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
          : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      {item.label}
      {!item.ready && (
        <Badge variant="outline" className="ml-auto h-[18px] px-1.5 text-[10px] font-medium text-muted-foreground">
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
      className="sticky top-0 hidden h-dvh w-58 shrink-0 flex-col gap-1 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3.5 py-[22px] text-sidebar-foreground lg:flex"
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
