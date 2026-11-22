import Image from "next/image";
import bossArt from "@/public/home/boss-art.webp";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * What the three lines will hold once the member features ship (`members` branch). Until then these are made-up
 * numbers, and the badge says so.
 */
const SAMPLE = [
  { label: "숙제 남은 캐릭터", value: "13", unit: "/ 14명", lead: true },
  { label: "사냥 수익", value: "+12.7", unit: "억" },
  { label: "보스 수익", value: "+134", unit: "억" },
];

/**
 * "이번 주 내 메이플" on the home page (user, 2026-11-22: the feel of the first design — the newest boss's picture
 * behind the week's numbers). The picture takes the right four fifths of the tile and fades out to the left, where
 * the lines are; the tile is dark in both themes, since the picture is.
 * The picture is cut from a capture of the in-game boss window: C:/dev/_work/maple/boss-art/crop.mjs makes
 * public/home/boss-art.webp, and a new boss only replaces that file and the name below.
 */
const BOSS_NAME = "벨로나";

export function MyWeek() {
  return (
    <section
      aria-label="이번 주 내 메이플"
      className="dark relative flex min-h-[248px] min-w-0 flex-[5_1_320px] flex-col justify-between gap-4 overflow-hidden rounded-[1rem] border border-transparent bg-[oklch(0.2_0.03_25)] p-4 text-foreground shadow-tile sm:p-6"
    >
      <Image
        src={bossArt}
        alt={`최신 보스 ${BOSS_NAME}`}
        sizes="(min-width: 1024px) 480px, 100vw"
        className="absolute inset-y-0 right-0 h-full w-[80%] [mask-image:linear-gradient(90deg,transparent,#000_38%)] object-cover object-[60%_18%]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-[oklch(0.17_0.03_25_/_0.94)] via-[oklch(0.17_0.03_25_/_0.72)] via-45% to-transparent to-80%" />
      <div className="relative flex min-h-7 items-center gap-2">
        <h2 className="text-[15px] font-bold whitespace-nowrap">이번 주 내 메이플</h2>
        <Badge variant="secondary" className="h-[18px] bg-black/45 px-[7px] text-[10px] font-medium whitespace-nowrap text-muted-foreground">
          준비 중 · 예시 숫자
        </Badge>
      </div>
      <ul aria-hidden="true" className="relative flex w-[58%] max-w-[260px] min-w-[200px] flex-col gap-1.5">
        {SAMPLE.map((row) => (
          <li
            key={row.label}
            className={cn(
              "flex items-baseline justify-between gap-3 rounded-[10px] px-3 py-2",
              row.lead ? "bg-primary/20 ring-1 ring-primary/50 ring-inset" : "bg-black/45 ring-1 ring-white/10 ring-inset",
            )}
          >
            <span className={cn("text-xs font-semibold whitespace-nowrap", row.lead ? "text-primary-text" : "text-muted-foreground")}>{row.label}</span>
            <span className="whitespace-nowrap">
              <b className={cn("font-num text-xl leading-none", row.lead && "text-primary-text")}>{row.value}</b>
              <span className="ml-1 text-xs text-muted-foreground">{row.unit}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="relative text-xs text-muted-foreground">로그인하면 내 숫자로 바뀜</p>
    </section>
  );
}
