import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
// Static import: the URL carries a content hash, so a new icon is never served from an old browser cache.
import brandMark from "@/public/brand-mark.png";

/** App icon (mushroom, same picture as app/icon.png) + site name. public/brand-mark.png is a 96px copy so the logo stays light. */
export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  const size = compact ? 28 : 32;
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center rounded-lg font-heading font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        compact ? "gap-2 text-[15px]" : "gap-2.5 text-[17px]",
        className
      )}
    >
      {/* unoptimized: the 96px file is already small, and the optimizer washed its colours out at 32px */}
      <Image src={brandMark} alt="" width={size} height={size} priority unoptimized className="shrink-0" />
      메이플 대시보드
    </Link>
  );
}
