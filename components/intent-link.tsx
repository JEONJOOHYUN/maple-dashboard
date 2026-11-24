"use client";

import { useState, type ComponentProps } from "react";
import Link, { useLinkStatus } from "next/link";
import type { NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Marks the link while the page it was pressed for is on the way. */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span data-pending="" hidden /> : null;
}

/**
 * A link to a page that is rendered per request (the member pages). Prefetching those from every page costs
 * uncached requests on each view; not prefetching at all leaves a press without an answer until the server replies.
 * So the page's `loading.tsx` is fetched ahead once the visitor points at the link, touches it or tabs to it, and a
 * press shows that at once. A press that comes first pulses the link until the server answers.
 * `whole` = the page itself is fetched ahead and shown without a fallback. Only for a page that holds nothing of a
 * member: what is fetched ahead stays in the browser for minutes, through a sign-out or another member's sign-in in
 * another tab, and through changes made on other pages.
 */
export function IntentLink({ whole, className, children, ...rest }: Omit<ComponentProps<typeof Link>, "prefetch"> & { whole?: boolean }) {
  const [near, setNear] = useState(false);
  const arm = () => setNear(true);
  return (
    <Link {...rest} prefetch={near ? (whole ? true : null) : false} onPointerEnter={arm} onFocus={arm} className={cn(className, "has-[[data-pending]]:animate-pulse")}>
      {children}
      <Pending />
    </Link>
  );
}

/** A menu item's link: a member page waits for intent (lib/nav.ts `prefetch`), any other is prefetched as usual. */
export function NavLink({ item, ...rest }: { item: Pick<NavItem, "href" | "prefetch"> } & Omit<ComponentProps<typeof Link>, "href" | "prefetch">) {
  const To = item.prefetch === false ? IntentLink : Link;
  return <To href={item.href} {...rest} />;
}
