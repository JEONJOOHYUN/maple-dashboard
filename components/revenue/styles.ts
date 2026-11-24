// Class strings the boss revenue screens share (and homework, for the difficulty colours), so a look changes in one place.

/** In-game difficulty badge colors (matches NEXON's boss difficulty banners), same in both themes: players read these at a glance. */
export const DIFF_STYLE: Record<string, { background: string; color: string }> = {
  이지: { background: "linear-gradient(#888888, #666666)", color: "#ffffff" },
  노멀: { background: "linear-gradient(#51b2cc, #319dbc)", color: "#ffffff" },
  하드: { background: "linear-gradient(#bb4466, #aa3355)", color: "#ffffff" },
  카오스: { background: "linear-gradient(#333333, #222233)", color: "#ffe1be" },
  익스트림: { background: "#09090b", color: "#da1b1b" },
};

export const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
/** A line that says something did not arrive (an account's key, some characters' schedulers). */
export const problemLine = "px-1 text-[13px] font-semibold text-destructive";
/** A one-line tile: what it says on the left, what to do about it on the right (the two wrap on a phone). */
export const lineTile = "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 tile px-4 py-3";
/** Outline of a pressable card or cell under the pointer. */
export const hoverRing = "hover:shadow-[inset_0_0_0_1px_var(--input)]";
/** A picked card or cell. */
export const pickedRing = "bg-primary/14 shadow-[inset_0_0_0_2px_var(--primary)]";
/** A trigger while its popover is open. */
export const openRing = "data-[popup-open]:shadow-[inset_0_0_0_2px_var(--primary)]";
/** Small rounded label (difficulty, 월간, 보스 n): add its colours. */
export const chip = "inline-flex h-5 shrink-0 items-center rounded-full px-[7px] pt-0.5 text-[11px] font-bold whitespace-nowrap";
/** A 40px icon button in a sheet's head (previous, next, close). */
export const sheetIcon = "grid size-10 place-items-center rounded-[10px] text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";
/** The panel of a character's side sheet: the whole width on a phone, 720px from there. */
export const sheetPanel = "gap-0 bg-card p-0 data-[side=right]:w-full data-[side=right]:border-border data-[side=right]:sm:max-w-[720px]";
/** The dot of each NEXON account when several are on show, in the order they were connected. */
export const ACCOUNT_COLORS = ["oklch(0.72 0.16 45)", "oklch(0.70 0.13 230)", "oklch(0.70 0.14 150)", "oklch(0.70 0.15 320)", "oklch(0.75 0.13 95)"];
