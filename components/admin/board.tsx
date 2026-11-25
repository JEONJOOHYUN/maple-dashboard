"use client";

import { memo, useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { applySiteValues } from "@/app/admin/actions";
import { ItemSearch, Pic, type DictHit, type RowHit } from "@/components/admin/item-search";
import { NumberField, parseNum } from "@/components/ev/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Reveal } from "@/components/ui/reveal";
import { Spinner } from "@/components/ui/spinner";
import { iconUrl, plainName } from "@/lib/enhance/dict";
import { DAY, dayStart, kstDate, kstFull, kstShort } from "@/lib/enhance/kst";
import { CREDIT_SHOP, MVP_ITEMS, itemImage } from "@/lib/ev/defaults";
import { CRYSTAL, ITEMS, iconSrc } from "@/lib/revenue/data";
import { changeName, changeText, describeChange, num } from "@/lib/site-values/describe";
import type { AdminRow, Change, HistoryRow } from "@/lib/site-values/server";
import { CELLS, CODE_DATES, OWN_REWARDS, cellOf, numberAt, sectionOf, storedOf, typedOf, type Cell, type Section } from "@/lib/site-values/cells";
import { extraId, extraKey, extras, starItems, type SiteValues } from "@/lib/site-values/values";
import { cn } from "@/lib/utils";

// The admin page: every default value on one sheet, top to bottom. A changed cell turns orange and joins the bar
// at the bottom, which says what changes and applies all of it at once (app/admin/actions.ts).

const DIFFS = ["이지", "노멀", "하드", "카오스", "익스트림"];
const BOSSES = [...new Set(Object.keys(CRYSTAL).map((key) => key.split("|")[0]))].map((boss) => ({ boss, cells: DIFFS.map((diff) => cellOf(`crystal|${boss}|${diff}`)) }));
/** The weekly bosses people ask about start here; the ones before it (mostly daily bosses) open on request. */
const MAIN_FROM = Math.max(0, BOSSES.findIndex((b) => b.boss === "스우"));
const CRYSTAL_COUNT = CELLS.filter((c) => c.group === "crystal").length;

const MARKET = [
  { cell: cellOf("market|mesoWon")!, title: "1억 메소 = 원" },
  { cell: cellOf("market|mesoMp")!, title: "메소마켓 1억 = 메이플포인트" },
  { cell: cellOf("market|giftWon")!, title: "선물 1만 캐시 = 원" },
];
const REWARDS = OWN_REWARDS.map((id) => ({ cell: cellOf(`reward|${id}`)!, img: iconSrc(ITEMS[id].icon) }));
type ShopRow = { id: string; name: string; where: string; cost: Cell; price?: Cell };
const SHOP: ShopRow[] = [
  ...CREDIT_SHOP.map((it) => ({ id: `credit|${it.id}`, name: it.name, where: "크레딧샵", cost: cellOf(`credit|${it.id}|credit`)!, price: cellOf(`credit|${it.id}|auction`) })),
  ...MVP_ITEMS.map((it) => ({
    id: `mvp|${it.id}`,
    name: it.name,
    where: it.ticketMan !== undefined ? "캐시샵 · 오른쪽 = 부티크 티켓 1장" : "캐시샵",
    cost: cellOf(`mvp|${it.id}|cash`)!,
    price: cellOf(`mvp|${it.id}|${it.ticketMan !== undefined ? "ticket" : "auction"}`),
  })),
];
/** The price of an added item is checked like a spare price (억, four decimals). */
const EXTRA_PRICE: Cell = { key: "", group: "spare", name: "", unit: "억", def: 0, scale: 1, digits: 4, max: 1_000_000 };

const fieldId = (key: string) => `v-${key}`;

type Look = "plain" | "changed" | "invalid";
/** How a cell looks for what is typed in it (nothing typed, or the value it already has = plain). */
function lookOf(cell: Cell, current: number | null, text: string | undefined): Look {
  if (text === undefined || text.trim() === "") return "plain";
  const stored = storedOf(cell, parseNum(text, Number.NaN));
  return stored === null ? "invalid" : stored !== current ? "changed" : "plain";
}

/** One number cell. Kept from re-drawing while another cell is typed in (there are some 150 on the page). */
const Field = memo(function Field({
  cellKey,
  label,
  text,
  placeholder,
  look,
  decimal,
  suffix,
  disabled,
  onText,
  className,
}: {
  cellKey: string;
  label: string;
  text: string;
  placeholder: string;
  look: Look;
  decimal: boolean;
  suffix?: string;
  disabled?: boolean;
  onText: (key: string, text: string) => void;
  className?: string;
}) {
  return (
    <NumberField
      id={fieldId(cellKey)}
      label={label}
      value={text}
      onChange={(t) => onText(cellKey, t)}
      placeholder={placeholder}
      decimal={decimal}
      suffix={suffix}
      disabled={disabled}
      className={cn("flex min-w-0 whitespace-nowrap", className)}
      inputClassName={cn("w-full disabled:opacity-50", look === "changed" && "border-primary text-primary-text ring-1 ring-primary", look === "invalid" && "border-destructive text-destructive")}
    />
  );
});

type Editing = { values: SiteValues; edits: Record<string, string>; onText: (key: string, text: string) => void };

/** A cell the code defines, showing the value in force until something is typed. */
function CellField({ cell, label, suffix, className, values, edits, onText }: { cell: Cell; label: string; suffix?: string; className?: string } & Editing) {
  const current = numberAt(values, cell);
  const text = edits[cell.key];
  const now = String(typedOf(cell, current));
  return (
    <Field
      cellKey={cell.key}
      label={label}
      text={text ?? now}
      placeholder={num(typedOf(cell, current))}
      look={lookOf(cell, current, text)}
      decimal={cell.digits > 0 || cell.scale > 1}
      suffix={suffix}
      onText={onText}
      className={className}
    />
  );
}

const PROBLEMS = {
  stale: "다른 관리자가 먼저 고친 칸이 있음 → 새로 고침 뒤 다시",
  invalid: "보낼 수 없는 값이 있음 → 새로 고침 뒤 다시",
  failed: "반영 못 함 → 잠시 뒤 다시",
  denied: "관리자 로그인이 풀림 → 다시 로그인",
  limited: "너무 자주 반영함 → 10분 뒤 다시",
};

const tile = "flex scroll-mt-4 flex-col gap-3 tile px-4 py-4 sm:px-5";
const h2 = "text-[15px] leading-tight font-bold";
const aside = "text-[13px] font-medium text-muted-foreground";
/**
 * The first cell of a crystal row: it reaches the row's own edges, and sticks at the scroll box's very edge (the box
 * is padded 4px for the focus rings), so nothing shows beside it.
 */
const stuck = "sticky -left-1 z-10 -my-1.5 -ml-2.5 flex min-w-0 items-center self-stretch py-1.5 pl-2.5";
const topButton = "inline-flex h-9 items-center rounded-[10px] tile-edge bg-card px-3.5 text-[13px] font-bold whitespace-nowrap";

type ItemRow = { key: string; name: string; img?: string; /** 억; null = picked from the dictionary, no price yet. */ current: number | null; extra?: "saved" | "new" };

export function AdminBoard({ values, history, admins, today }: { values: SiteValues; history: HistoryRow[]; admins: AdminRow[]; /** The server's day (KST), so the first HTML and the browser agree. */ today: string }) {
  const router = useRouter();
  // What is typed, by key. A cell is "changed" only while its text is a value other than the one in force.
  const [edits, setEdits] = useState<Record<string, string>>({});
  // Items picked from the dictionary that are not saved yet, and saved ones marked to be taken out.
  const [added, setAdded] = useState<Record<string, DictHit>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");
  const [lowOpen, setLowOpen] = useState(false);
  const [problem, setProblem] = useState<keyof typeof PROBLEMS | "">("");
  const [done, setDone] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [adminsOpen, setAdminsOpen] = useState(false);
  const [sending, startSending] = useTransition();

  const onText = useCallback((key: string, text: string) => {
    setEdits((prev) => ({ ...prev, [key]: text }));
    setDone("");
  }, []);
  const editing: Editing = { values, edits, onText };

  const saved = extras(values);
  const itemGroups = useMemo(() => {
    const byLevel = new Map<number, ItemRow[]>();
    for (const g of starItems(values)) {
      byLevel.set(
        g.level,
        g.items.map((it) => {
          const extra = it.id === extraId(it.name) && it.name in saved;
          return { key: extra ? extraKey(it.name) : `spare|${it.id}`, name: it.name, img: it.icons[0] ? itemImage(it.icons[0]) : undefined, current: it.spareEok, extra: extra ? ("saved" as const) : undefined };
        })
      );
    }
    for (const hit of Object.values(added)) {
      if (hit.name in saved) continue;
      const rows = byLevel.get(hit.level) ?? [];
      rows.push({ key: extraKey(hit.name), name: hit.name, img: iconUrl(hit.icon) || undefined, current: null, extra: "new" });
      byLevel.set(hit.level, rows);
    }
    return [...byLevel].sort((a, b) => a[0] - b[0]).map(([level, rows]) => ({ level, rows }));
  }, [values, saved, added]);
  const itemCount = itemGroups.reduce((n, g) => n + g.rows.length, 0) + REWARDS.length;

  const searchRows = useMemo<RowHit[]>(
    () => [
      ...itemGroups.flatMap((g) => g.rows.map((r) => ({ kind: "row" as const, key: r.key, name: r.name, group: `${g.level}제`, value: r.current === null ? "가격 없음" : `${num(r.current)}억`, img: r.img }))),
      ...REWARDS.map(({ cell, img }) => ({ kind: "row" as const, key: cell.key, name: cell.name, group: "보스 보상", value: `${num(typedOf(cell, numberAt(values, cell)))}억`, img })),
    ],
    [itemGroups, values]
  );
  const taken = useMemo(() => new Set(itemGroups.flatMap((g) => g.rows.map((r) => r.name))), [itemGroups]);

  const changes = useMemo(() => {
    const out: Change[] = [];
    for (const cell of CELLS) {
      const text = edits[cell.key];
      if (text === undefined || text.trim() === "") continue;
      const stored = storedOf(cell, parseNum(text, Number.NaN));
      const current = numberAt(values, cell);
      if (stored !== null && stored !== current) out.push({ key: cell.key, from: current, to: stored });
    }
    const price = (key: string) => {
      const text = edits[key];
      return text === undefined || text.trim() === "" ? null : storedOf(EXTRA_PRICE, parseNum(text, Number.NaN));
    };
    for (const [name, extra] of Object.entries(saved)) {
      const key = extraKey(name);
      if (removed.includes(name)) out.push({ key, from: extra, to: null });
      else {
        const spareEok = price(key);
        if (spareEok !== null && spareEok !== extra.spareEok) out.push({ key, from: extra, to: { ...extra, spareEok } });
      }
    }
    for (const hit of Object.values(added)) {
      if (hit.name in saved) continue;
      const spareEok = price(extraKey(hit.name));
      if (spareEok !== null) out.push({ key: extraKey(hit.name), from: null, to: { level: hit.level, icon: hit.icon, spareEok } });
    }
    return out;
  }, [edits, values, saved, removed, added]);

  // Days since each part was last changed: here, or (nothing in the history shown) in the code.
  const ages = useMemo(() => {
    const last: Record<Section, string> = { ...CODE_DATES };
    for (const row of history) {
      const day = kstDate(Date.parse(row.at));
      for (const c of row.changes) {
        const part = sectionOf(c.key);
        if (day > last[part]) last[part] = day;
      }
    }
    return last;
  }, [history]);
  const age = (part: Section) => {
    const days = Math.max(0, Math.round((dayStart(today) - dayStart(ages[part])) / DAY));
    return days === 0 ? "오늘 고침" : `${days}일 전에 고침`;
  };

  /** Moves to a row of the item list (after the search list has closed and handed the focus back to its box). */
  const focusRow = (key: string) =>
    setTimeout(() => {
      const el = document.getElementById(fieldId(key)) as HTMLInputElement | null;
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
      el.select();
    }, 0);
  const goRow = (key: string) => {
    flushSync(() => setFilter(""));
    focusRow(key);
  };
  const addItem = (hit: DictHit) => {
    flushSync(() => {
      setAdded((prev) => ({ ...prev, [hit.name]: hit }));
      setFilter("");
    });
    focusRow(extraKey(hit.name));
  };
  const dropNew = (name: string) => {
    setAdded((prev) => Object.fromEntries(Object.entries(prev).filter(([n]) => n !== name)));
    setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== extraKey(name))));
  };
  const toggleRemoved = (name: string) => {
    setRemoved((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
    setDone("");
  };

  const reset = () => {
    setEdits({});
    setAdded({});
    setRemoved([]);
    setProblem("");
  };
  const apply = () =>
    startSending(async () => {
      // What is sent, as it is now: a cell typed in while the request is on its way is not part of it and stays.
      // The same for an item: only an adding or a taking out that was itself sent is done with.
      const sent = new Set(changes.map((c) => c.key));
      const sentNew = new Set(changes.filter((c) => c.from === null).map((c) => c.key));
      const sentOut = new Set(changes.filter((c) => c.to === null).map((c) => c.key));
      const texts = edits;
      const result = await applySiteValues(note, changes);
      if (result === "ok") {
        setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([key, text]) => !sent.has(key) || text !== texts[key])));
        setAdded((prev) => Object.fromEntries(Object.entries(prev).filter(([name]) => !sentNew.has(extraKey(name)))));
        setRemoved((prev) => prev.filter((name) => !sentOut.has(extraKey(name))));
        setProblem("");
        setNote("");
        setDone(`${sent.size}개 반영됨`);
      } else setProblem(result);
    });

  const q = plainName(filter);
  const match = (name: string) => !q || plainName(name).includes(q);
  const shownGroups = itemGroups.map((g) => ({ ...g, rows: g.rows.filter((r) => match(r.name)) })).filter((g) => g.rows.length > 0);
  const shownRewards = REWARDS.filter(({ cell }) => match(cell.name));
  const last = history[0];
  const SUMMARY = 3;

  const bossRow = (b: (typeof BOSSES)[number], index: number) => (
    <div key={b.boss} className={cn("grid grid-cols-[minmax(150px,1.4fr)_repeat(5,minmax(0,1fr))] items-center gap-2 rounded-[10px] px-2.5 py-1.5", index % 2 === 1 && "bg-background")}>
      {/* Stays at the left edge while the table is scrolled sideways (a phone), on the row's own fill. */}
      <span className={cn(stuck, "rounded-l-[10px]", index % 2 === 1 ? "bg-background" : "bg-card")}>
        <span className="truncate text-[13px] font-bold" title={b.boss}>
          {b.boss}
        </span>
      </span>
      {b.cells.map((cell, i) =>
        cell ? (
          <CellField key={DIFFS[i]} cell={cell} label={`${cell.name} 결정석, 만 메소`} {...editing} />
        ) : (
          <span key={DIFFS[i]} aria-hidden="true" className="pr-3 text-right text-border">
            ·
          </span>
        )
      )}
    </div>
  );

  const itemRow = (r: ItemRow) => {
    const gone = r.extra === "saved" && removed.includes(r.name);
    const text = edits[r.key];
    return (
      <ItemLine
        key={r.key}
        fieldKey={r.key}
        name={r.name}
        img={r.img}
        gone={gone}
        action={
          r.extra &&
            (gone ? (
              <button type="button" onClick={() => toggleRemoved(r.name)} className="relative shrink-0 text-xs font-bold whitespace-nowrap text-primary-text after:absolute after:-inset-2">
                빼기 취소
              </button>
            ) : (
              <button
                type="button"
                aria-label={`${r.name} 목록에서 빼기`}
                onClick={() => (r.extra === "new" ? dropNew(r.name) : toggleRemoved(r.name))}
                className="relative grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground after:absolute after:-inset-2 hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ))
        }
      >
        <Field
          cellKey={r.key}
          label={`${r.name} 노작값, 억 메소`}
          text={text ?? (r.current === null ? "" : String(r.current))}
          placeholder={r.current === null ? "가격" : num(r.current)}
          look={gone ? "plain" : lookOf(EXTRA_PRICE, r.current, text)}
          decimal
          disabled={gone}
          onText={onText}
        />
      </ItemLine>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-3 pt-1 pb-2 lg:px-[18px]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-heading text-[22px] leading-tight font-bold lg:text-[26px]">관리자</h1>
            <span className="text-[13px] text-muted-foreground">메이플 대시보드 · 기본값</span>
          </div>
          <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">여기서 고치면 모든 방문자의 기본값이 바뀜 · 방문자가 직접 적은 값은 그대로</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {last && (
            <span className="inline-flex h-[30px] items-center rounded-full bg-muted px-3 text-[13px] font-semibold whitespace-nowrap text-muted-foreground" data-clarity-mask="true">
              마지막 반영 {kstShort(Date.parse(last.at))} · {last.who}
            </span>
          )}
          <button type="button" className={topButton} onClick={() => setHistoryOpen(true)}>
            고친 기록
          </button>
          <button type="button" className={topButton} onClick={() => setAdminsOpen(true)}>
            관리자 {admins.length}명
          </button>
        </div>
      </div>

      <nav aria-label="구역으로 가기" className="flex flex-wrap gap-1.5 pb-1">
        {[
          { href: "#market", name: "메소 · 메포 시세", count: MARKET.length },
          { href: "#crystal", name: "보스 결정석", count: CRYSTAL_COUNT },
          { href: "#items", name: "아이템 노작값", count: itemCount },
          { href: "#shop", name: "큐브 · 캐시", count: SHOP.length },
        ].map((j) => (
          <a key={j.href} href={j.href} className="inline-flex h-[34px] items-center gap-1.5 rounded-full tile-edge bg-card px-3.5 text-[13px] font-bold whitespace-nowrap">
            {j.name} <span className="font-medium text-muted-foreground">{j.count}</span>
          </a>
        ))}
      </nav>

      <section id="market" className={tile}>
        <Head title="메소 · 메포 시세" right={age("market")} />
        <div className="grid gap-3 sm:grid-cols-3">
          {MARKET.map(({ cell, title }) => {
            const current = numberAt(values, cell);
            return (
              <div key={cell.key} className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={fieldId(cell.key)} className="text-[13px] text-muted-foreground">
                  {title}
                </label>
                <CellField cell={cell} label={`${cell.name}, ${cell.unit}`} suffix={cell.unit} {...editing} />
                {/* Its room is always there, so the three cards keep one height. */}
                <span className="min-h-4 text-xs text-primary-text">{lookOf(cell, current, edits[cell.key]) === "changed" && `지금 ${num(current)}${cell.unit}`}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section id="crystal" className={cn(tile, "px-2 sm:px-3")}>
        <Head className="px-2" title="보스 결정석 가격" sub={`만 메소 · ${CRYSTAL_COUNT}칸`} right={`${age("crystal")} · 빈칸 = 그 난이도 없음`} />
        {/* The padding keeps a focus ring inside the scroll box; the negative margin gives its room back. */}
        <div className="-m-1 overflow-x-auto p-1">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[minmax(150px,1.4fr)_repeat(5,minmax(0,1fr))] gap-2 px-2.5 py-1.5 text-xs font-bold text-muted-foreground">
              <span className={cn(stuck, "bg-card")}>보스</span>
              {DIFFS.map((d) => (
                <span key={d} className="text-right">
                  {d}
                </span>
              ))}
            </div>
            {BOSSES.slice(MAIN_FROM).map((b, i) => bossRow(b, i))}
            <Reveal open={lowOpen}>{lowOpen && BOSSES.slice(0, MAIN_FROM).map((b, i) => bossRow(b, BOSSES.length - MAIN_FROM + i))}</Reveal>
          </div>
        </div>
        {MAIN_FROM > 0 && (
          <button type="button" aria-expanded={lowOpen} onClick={() => setLowOpen(!lowOpen)} className="h-9 self-center rounded-[10px] px-4 text-[13px] font-bold text-primary-text hover:bg-muted">
            {lowOpen ? "나머지 보스 접기" : `나머지 보스 ${MAIN_FROM}개 펼치기`}
          </button>
        )}
      </section>

      <section id="items" className={tile}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <Head className="min-w-0 flex-1 basis-60" title="아이템 노작값" sub={`억 메소 · ${itemCount}개`} right={age("items")} below="기댓값 계산기 · 강화 기록 · 보스 수익 보상 가격이 같이 씀" />
          <ItemSearch rows={searchRows} taken={taken} onGo={goRow} onAdd={addItem} onFilter={setFilter} />
        </div>
        {q && shownGroups.length === 0 && shownRewards.length === 0 && <p className="py-6 text-center text-[13px] text-muted-foreground">“{filter}”가 든 줄 없음</p>}
        {shownGroups.map((g) => (
          <div key={g.level} className="flex flex-col gap-1">
            <span className="text-xs font-bold text-muted-foreground">{g.level}제</span>
            <div className={ITEM_GRID}>{g.rows.map(itemRow)}</div>
          </div>
        ))}
        {shownRewards.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-muted-foreground">보스 보상 · 보스 수익만 씀</span>
            <div className={ITEM_GRID}>
              {shownRewards.map(({ cell, img }) => (
                <ItemLine key={cell.key} fieldKey={cell.key} name={cell.name} img={img}>
                  <CellField cell={cell} label={`${cell.name} 가격, 억 메소`} {...editing} />
                </ItemLine>
              ))}
            </div>
          </div>
        )}
      </section>

      <section id="shop" className={tile}>
        <Head title="큐브 · 캐시 아이템" sub={`${SHOP.length}개`} right={age("shop")} below="MVP 계산기 · 기댓값 계산기 · 강화 기록의 큐브 가격" />
        <div className="flex flex-col">
          <div className="hidden grid-cols-[minmax(0,1fr)_148px_148px] gap-2.5 pb-1.5 text-xs font-bold text-muted-foreground sm:grid">
            <span>이름</span>
            <span>캐시 · 크레딧</span>
            <span>경매장</span>
          </div>
          {SHOP.map((row) => (
            <div key={row.id} className="grid grid-cols-2 items-center gap-x-2.5 gap-y-1.5 border-t border-border py-2.5 sm:min-h-[52px] sm:grid-cols-[minmax(0,1fr)_148px_148px] sm:py-0">
              <span className="col-span-2 flex min-w-0 flex-wrap items-baseline gap-x-2 sm:col-span-1">
                <b className="text-[13px] font-semibold">{row.name}</b>
                <span className="text-xs text-muted-foreground">{row.where}</span>
              </span>
              <CellField cell={row.cost} label={`${row.name} ${row.cost.unit} 가격`} suffix={row.cost.unit} {...editing} />
              {row.price ? <CellField cell={row.price} label={`${row.name} 경매장 가격, ${row.price.unit} 메소`} suffix={row.price.unit} {...editing} /> : <span className="text-xs text-muted-foreground">캐시샵 줄과 같음</span>}
            </div>
          ))}
        </div>
      </section>

      {(changes.length > 0 || problem || done) && (
        // Only "n개 반영됨" to say: a small pill in the middle instead of the whole bar.
        <div className={cn("sticky bottom-4 z-20 mt-2 flex flex-col gap-2.5 rounded-2xl bg-popover px-4 py-3 text-popover-foreground shadow-lift sm:px-5", changes.length === 0 && !problem && "w-fit self-center")}>
          {changes.length > 0 ? (
            <>
              <p className="text-[13px] leading-relaxed text-pretty">
                <b className="text-primary-text">{changes.length}개 바뀜</b>
                <span className="text-muted-foreground">
                  {changes.slice(0, SUMMARY).map((c) => ` · ${describeChange(c.key, c.from, c.to)}`)}
                  {changes.length > SUMMARY && ` · 외 ${changes.length - SUMMARY}개`}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label="왜 고쳤는지"
                  placeholder="왜 고쳤는지 한 줄 (안 적어도 됨)"
                  value={note}
                  maxLength={200}
                  onChange={(e) => setNote(e.target.value)}
                  // 16px on a phone: a smaller input makes iOS zoom the page in on focus.
                  className="h-11 min-w-0 flex-1 basis-56 rounded-xl border border-input bg-background px-3 text-base outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 sm:text-sm"
                />
                <button type="button" onClick={reset} disabled={sending} className="h-11 rounded-xl px-4 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
                  되돌리기
                </button>
                <button type="button" onClick={apply} disabled={sending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold whitespace-nowrap text-primary-foreground disabled:opacity-60">
                  {sending && <Spinner />}
                  {changes.length}개 반영하기
                </button>
              </div>
            </>
          ) : (
            done && (
              <p role="status" className="text-[13px] font-bold">
                {done}
              </p>
            )
          )}
          {problem && (
            <p role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-destructive">
              {PROBLEMS[problem]}
              {(problem === "stale" || problem === "invalid") && (
                <button
                  type="button"
                  onClick={() => {
                    setProblem("");
                    router.refresh();
                  }}
                  className="relative font-bold text-primary-text after:absolute after:-inset-2"
                >
                  새로 고침
                </button>
              )}
            </p>
          )}
        </div>
      )}

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle className="font-bold">고친 기록</DialogTitle>
          <DialogDescription className="sr-only">누가 언제 무엇을 고쳤는지, 최근 것부터</DialogDescription>
          {history.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">아직 고친 기록 없음</p>
          ) : (
            <ul className="flex flex-col" data-clarity-mask="true">
              {history.map((row) => (
                <li key={row.id} className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0 first:pt-0">
                  <span className="text-xs text-muted-foreground">
                    {kstFull(Date.parse(row.at))} · {row.who}
                  </span>
                  {row.changes.map((c) => (
                    <span key={c.key} className="text-[13px] text-pretty">
                      <b>{changeName(c.key) ?? c.key}</b> {changeText(c.key, c.from, c.to)}
                    </span>
                  ))}
                  {row.note && <span className="text-[13px] text-muted-foreground">{row.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={adminsOpen} onOpenChange={setAdminsOpen}>
        <DialogContent>
          <DialogTitle className="font-bold">관리자 {admins.length}명</DialogTitle>
          <DialogDescription className="sr-only">기본값을 고칠 수 있는 사람</DialogDescription>
          <ul className="flex flex-col" data-clarity-mask="true">
            {admins.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
                <b className="truncate text-[13px]">{a.name || "이름 없음"}</b>
                <span className="text-xs whitespace-nowrap text-muted-foreground">
                  {a.role === "owner" ? "주인" : "편집"} · {kstDate(Date.parse(a.since))}부터
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The rows of one level, or of the boss rewards: one column on a phone, as many as fit from there. */
const ITEM_GRID = "grid grid-cols-1 gap-x-7 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]";

/** One priced thing of the item part: picture, name (with what can be done to it), its price cell in 억. */
function ItemLine({ fieldKey, name, img, gone, action, children }: { fieldKey: string; name: string; img?: string; gone?: boolean; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-[52px] grid-cols-[32px_minmax(0,1fr)_104px_16px] items-center gap-2.5 border-t border-border">
      <Pic src={img} />
      <span className="flex min-w-0 items-center gap-1.5">
        <label htmlFor={fieldId(fieldKey)} className={cn("truncate text-[13px] font-semibold", gone && "text-muted-foreground line-through")} title={name}>
          {name}
        </label>
        {action}
      </span>
      {children}
      <span className="text-[13px] text-muted-foreground">억</span>
    </div>
  );
}

/** A part's heading: its name with a muted count beside it, what uses it underneath, and how old it is on the right. */
function Head({ title, sub, right, below, className }: { title: string; sub?: string; right?: ReactNode; below?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className={h2}>
          {title}
          {sub && <span className={cn(aside, "ml-2")}>{sub}</span>}
        </h2>
        {right && <span className={aside}>{right}</span>}
      </div>
      {below && <span className="text-[13px] text-muted-foreground">{below}</span>}
    </div>
  );
}
