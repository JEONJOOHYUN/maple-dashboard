"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { searchItemDict } from "@/app/admin/actions";
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxGroup, ComboboxInput, ComboboxItem, ComboboxLabel, ComboboxList } from "@/components/ui/combobox";
import { InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { iconUrl, plainName } from "@/lib/enhance/dict";

/** A row of the item list, as the search offers it. */
export type RowHit = { kind: "row"; key: string; name: string; group: string; value: string; img?: string };
/** An item of the shared dictionary that is not on the list yet. */
export type DictHit = { kind: "dict"; name: string; level: number; part: string; icon: string };
type Hit = RowHit | DictHit;
type HitGroup = { value: string; items: Hit[] };

/** Rows of the list offered at most: the box is for finding one, Enter narrows the whole list. */
const ROWS_SHOWN = 4;
const TYPING_MS = 250;

export function Pic({ src, className = "size-8" }: { src?: string; className?: string }) {
  if (!src) return <span aria-hidden="true" className={`${className} shrink-0 rounded-lg bg-muted`} />;
  // Small sprites from NEXON or our own files: fetched only when they come on screen.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" decoding="async" className={`${className} shrink-0 rounded-lg bg-muted object-contain p-[3px]`} />;
}

/**
 * The search of the item part: a name on the list jumps to its row, a name from the shared dictionary adds a row,
 * and Enter keeps only the rows that have the typed text.
 */
export function ItemSearch({
  rows,
  taken,
  onGo,
  onAdd,
  onFilter,
}: {
  rows: RowHit[];
  /** Names on the list already (waiting ones too): not offered from the dictionary. */
  taken: ReadonlySet<string>;
  onGo: (key: string) => void;
  onAdd: (item: DictHit) => void;
  /** "" = show every row again. */
  onFilter: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  // What the dictionary answered, with the text it was asked for (an answer to older text is not shown).
  const [found, setFound] = useState<{ q: string; items: DictHit[] }>({ q: "", items: [] });
  const highlighted = useRef<Hit | undefined>(undefined);
  const q = plainName(text);

  useEffect(() => {
    if (!q) return;
    let live = true;
    const timer = setTimeout(async () => {
      const items = await searchItemDict(q, [...taken]);
      if (live) setFound({ q, items: items.map((it) => ({ kind: "dict", name: it.name, level: it.level, part: it.part, icon: it.icon })) });
    }, TYPING_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, taken]);

  const groups = useMemo<HitGroup[]>(() => {
    if (!q) return [];
    const listed: Hit[] = rows.filter((r) => plainName(r.name).includes(q)).slice(0, ROWS_SHOWN);
    const fresh: Hit[] = found.q === q ? found.items.filter((d) => !taken.has(d.name)) : [];
    return [
      { value: "목록에 있는 아이템 · 누르면 그 줄로", items: listed },
      { value: "아이템 사전에서 새로 넣기", items: fresh },
    ].filter((g) => g.items.length > 0);
  }, [q, rows, found, taken]);

  const close = () => {
    setOpen(false);
    highlighted.current = undefined;
  };

  return (
    <Combobox<Hit>
      items={groups}
      filteredItems={groups}
      value={null}
      onValueChange={(hit) => {
        if (!hit) return;
        setText("");
        close();
        if (hit.kind === "row") onGo(hit.key);
        else onAdd(hit);
      }}
      inputValue={text}
      onInputValueChange={(next, details) => {
        // Only what is typed, or the cross: Base UI also empties the box as the list closes, which undid an Enter search.
        if (details.reason !== "input-change" && details.reason !== "clear-press") return;
        setText(next);
        highlighted.current = undefined;
        if (next === "") onFilter("");
      }}
      open={open && q !== ""}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      onItemHighlighted={(hit) => {
        highlighted.current = hit as Hit | undefined;
      }}
      itemToStringLabel={(hit) => hit.name}
      isItemEqualToValue={(a, b) => a.kind === b.kind && a.name === b.name}
    >
      <ComboboxInput
        aria-label="아이템 이름으로 찾기"
        placeholder="아이템 이름"
        showTrigger={false}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || highlighted.current) return;
          // The Enter that ends a Hangul syllable is not the search (the syllable is still on its way).
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          onFilter(e.currentTarget.value.trim());
          close();
        }}
        // The typed text is 16px on a phone: iOS zooms the page in on a field with smaller text.
        className="h-11 w-full rounded-xl border-border bg-background sm:w-[340px] dark:bg-background [&_input]:text-base sm:[&_input]:text-[15px]"
      >
        <InputGroupAddon align="inline-start">
          <Search className="size-4" aria-hidden="true" />
        </InputGroupAddon>
        {/* Base UI's own cross shows only for a name taken from the list: typed text gets this one. */}
        {text !== "" && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              variant="ghost"
              aria-label="검색 지우기"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setText("");
                onFilter("");
                close();
              }}
            >
              <X aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </ComboboxInput>
      <ComboboxContent align="end" className="w-[min(27.5rem,calc(100vw-2rem))]">
        <ComboboxEmpty>목록 · 사전에 없음</ComboboxEmpty>
        <ComboboxList className="max-h-[min(22rem,calc(var(--available-height)-2.5rem))]">
          {(group: HitGroup) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel className="font-bold">{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(hit: Hit) => (
                  <ComboboxItem key={`${hit.kind}|${hit.name}`} value={hit} className="min-h-11 gap-2.5 py-1.5 pr-2.5 pl-2">
                    <Pic src={hit.kind === "row" ? hit.img : iconUrl(hit.icon) || undefined} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="truncate text-[13px]" title={hit.name}>
                        {hit.name}
                      </b>
                      <span className="truncate text-xs text-muted-foreground">{hit.kind === "row" ? hit.group : [`${hit.level}제`, hit.part].filter(Boolean).join(" · ")}</span>
                    </span>
                    {hit.kind === "row" ? <b className="font-num text-[13px] whitespace-nowrap">{hit.value}</b> : <span className="text-[13px] font-bold whitespace-nowrap text-primary-text">＋ 넣기</span>}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Enter = 이름에 “{text.trim()}”가 든 줄만 보기</p>
      </ComboboxContent>
    </Combobox>
  );
}
