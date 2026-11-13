import { Construction, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
// Static imports: each address carries a content hash, so a redrawn icon is never served from an old browser cache.
import alerts from "@/public/icons/alerts.svg";
import boss from "@/public/icons/boss.svg";
import bossSplit from "@/public/icons/boss-split.svg";
import enhance from "@/public/icons/enhance.svg";
import ev from "@/public/icons/ev.svg";
import home from "@/public/icons/home.svg";
import homework from "@/public/icons/homework.svg";
import income from "@/public/icons/income.svg";
import mvp from "@/public/icons/mvp.svg";
import pinball from "@/public/icons/pinball.svg";
import revenue from "@/public/icons/revenue.svg";
import spec from "@/public/icons/spec.svg";
import sunday from "@/public/icons/sunday.svg";

/**
 * Our own picture of each tool, by its slug (lib/nav.ts): drawn to go with the mascot — soft, glossy, each with its
 * little face (user, 2026-11-13; drawn by Codex, originals outside the repository). A tool without one falls back to
 * its line icon.
 */
const ART: Record<string, { src: string }> = { home, income, homework, revenue, enhance, alerts, "boss-split": bossSplit, ev, mvp, sunday, spec, boss, pinball };

export const hasArt = (slug: string) => Object.hasOwn(ART, slug);

export function NavIcon({ slug, icon, className }: { slug: string; icon?: LucideIcon; className?: string }) {
  if (hasArt(slug)) {
    // eslint-disable-next-line @next/next/no-img-element -- a small SVG of our own, shown as it is
    return <img src={ART[slug].src} alt="" className={cn("shrink-0", className)} />;
  }
  const Icon = icon ?? Construction;
  return <Icon className={cn("shrink-0", className)} aria-hidden="true" />;
}
