/**
 * Table rows as the confirmed design has them (user, 2026-11-22): no rules between the rows; every other row sits on
 * the sheet colour, with its two ends rounded. The cells carry the fill, since a table row cannot be rounded.
 * The row's fill reaches 12px past the text on both sides: give the scroll box around the table `sm:-mx-3`, so the
 * text itself stays on the edge of the tile's content.
 */
export const ZEBRA_TABLE = "w-full border-separate border-spacing-0";
export const ZEBRA_HEAD = "text-left text-[11px] text-muted-foreground [&>th]:px-3 [&>th]:font-medium";
export const ZEBRA_ROW =
  "[&>td]:px-3 [&>td:first-child]:rounded-l-[10px] [&>td:last-child]:rounded-r-[10px] even:[&>td]:bg-background";
/** The scroll box around a zebra table inside a tile padded 16px on phones and 20px from `sm`. */
export const ZEBRA_SCROLL = "-mx-4 overflow-x-auto px-1 sm:-mx-3 sm:px-0";
