"use client";

import { memo, useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { addSiteAdmin, applySiteValues, removeSiteAdmin } from "@/app/admin/actions";
import { DictSection } from "@/components/admin/dict-section";
import { ItemSearch, Pic, type RowHit } from "@/components/admin/item-search";
import { NumberField, Segment, parseNum } from "@/components/ev/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Reveal } from "@/components/ui/reveal";
import { Spinner } from "@/components/ui/spinner";
import { plainName } from "@/lib/enhance/dict";
import { knownItem } from "@/lib/enhance/items";
import { DAY, dayStart, kstDate, kstFull, kstShort } from "@/lib/enhance/kst";
import { CREDIT_SHOP, MVP_ITEMS, itemImage } from "@/lib/ev/defaults";
import { CRYSTAL, ITEMS, iconSrc } from "@/lib/revenue/data";
import { CELLS, CODE_DATES, OWN_REWARDS, cellOf, numberAt, sectionOf, storedOf, typedOf, unitFor, type Cell, type CrystalUnit, type Section } from "@/lib/site-values/cells";
import { changeName, changeText, describeChange, num } from "@/lib/site-values/describe";
import { dictKey, editedState, sameDict, stateOf, type DictEdit, type DictRow } from "@/lib/site-values/dict-edit";
import type { AdminRow, Change, HistoryRow } from "@/lib/site-values/server";
import { starItems, type SiteValues } from "@/lib/site-values/values";
import { useStored } from "@/lib/use-stored";
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
const SETS = CELLS.filter((c) => c.group === "set");
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

const fieldId = (key: string) => `v-${key}`;

/** The unit the crystal table is typed in: by the size of each value, one unit for every cell, or meso as it is. */
const CRYSTAL_UNITS: { id: CrystalUnit; label: string; hint?: string }[] = [
  { id: "auto", label: "자동", hint: "1억부터 억, 그 아래는 만" },
  { id: "만", label: "만" },
  { id: "억", label: "억" },
  { id: "메소", label: "원본", hint: "메소 그대로 (9억 = 900,000,000)" },
];

type Look = "plain" | "changed" | "invalid";
/** How a cell looks for what is typed in it (nothing typed, or the value it already has = plain). */
function lookOf(cell: Cell, current: number, text: string | undefined, scale: number): Look {
  if (text === undefined || text.trim() === "") return "plain";
  const stored = storedOf(cell, parseNum(text, Number.NaN), scale);
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
  scale,
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
  /** The unit the cell is typed in: handed back with the text, so the text is always read in it. */
  scale: number;
  onText: (key: string, text: string, scale: number) => void;
  className?: string;
}) {
  return (
    <NumberField
      id={fieldId(cellKey)}
      label={label}
      value={text}
      onChange={(t) => onText(cellKey, t, scale)}
      placeholder={placeholder}
      decimal={decimal}
      suffix={suffix}
      className={cn("flex min-w-0 whitespace-nowrap", className)}
      inputClassName={cn("w-full", look === "changed" && "border-primary text-primary-text ring-1 ring-primary", look === "invalid" && "border-destructive text-destructive")}
    />
  );
});

type Editing = {
  values: SiteValues;
  edits: Record<string, string>;
  /** The scale each typed text was typed in (crystals: their unit can change under the text). */
  typedIn: Record<string, number>;
  onText: (key: string, text: string, scale: number) => void;
  crystal: CrystalUnit;
};
/** The unit a cell shows and reads now. */
const unitOf = (cell: Cell, current: number, e: Pick<Editing, "edits" | "typedIn" | "crystal">) => unitFor(cell, current, e.crystal, e.edits[cell.key] !== undefined ? e.typedIn[cell.key] : undefined);

/**
 * A cell the code defines, showing the value in force until something is typed. `unit` = write the unit it is typed
 * in after it (a crystal is typed in 억 from 1억 up, in 만 under it: the unit differs from cell to cell).
 */
function CellField({ cell, label, suffix, unit, className, ...editing }: { cell: Cell; label: string; suffix?: string; unit?: boolean; className?: string } & Editing) {
  const { values, edits, onText } = editing;
  const current = numberAt(values, cell);
  const as = unitOf(cell, current, editing);
  const text = edits[cell.key];
  const now = typedOf(cell, current, as.scale);
  return (
    <Field
      cellKey={cell.key}
      label={unit ? `${label}, ${as.unit} 메소` : label}
      text={text ?? String(now)}
      placeholder={num(now)}
      look={lookOf(cell, current, text, as.scale)}
      decimal={cell.digits > 0 || as.scale > 1}
      // Plain meso needs the whole cell for its digits: the choice above the table says the unit.
      suffix={unit ? (as.scale === 1 ? undefined : as.unit) : suffix}
      scale={as.scale}
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
const ADMIN_PROBLEMS = {
  denied: "주인만 할 수 있음",
  invalid: "이메일 · 이름을 다시 확인",
  notMember: "그 이메일로 로그인한 회원이 없음 → 먼저 구글 로그인을 한 번",
  already: "이미 관리자",
  last: "주인은 뺄 수 없음",
  failed: "저장 못 함 → 잠시 뒤 다시",
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
const textInput = "h-10 min-w-0 rounded-lg border border-input bg-background px-3 text-base outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 sm:text-sm";
const CRYSTAL_COLS = "grid grid-cols-[minmax(140px,1.2fr)_repeat(5,minmax(0,1fr))]";

export function AdminBoard({
  values,
  dict,
  history,
  admins,
  me,
  today,
}: {
  values: SiteValues;
  dict: DictRow[];
  history: HistoryRow[];
  admins: AdminRow[];
  /** The admin looking at the page: only an owner adds and removes admins. */
  me: { id: string; owner: boolean };
  /** The server's day (KST), so the first HTML and the browser agree. */
  today: string;
}) {
  const router = useRouter();
  // What is typed, by key. A cell is "changed" only while its text is a value other than the one in force.
  const [edits, setEdits] = useState<Record<string, string>>({});
  // The dictionary: what is typed in a row, rows marked as looked at, and names it does not have yet.
  const [dictEdits, setDictEdits] = useState<Record<string, DictEdit>>({});
  const [checks, setChecks] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string[]>([]);
  const [dictQuery, setDictQuery] = useState("");
  // A jump from the item search opens the dictionary with its filters cleared (a new key = a new section).
  const [jump, setJump] = useState(0);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");
  // How the admin likes the crystal table (its unit, the lower bosses open or not): kept in this browser.
  const [lowOpen, setLowOpen] = useStored<boolean>("admin:lowBosses", false);
  const [unitKept, setCrystal] = useStored<CrystalUnit>("admin:crystalUnit", "auto");
  const crystal: CrystalUnit = CRYSTAL_UNITS.some((u) => u.id === unitKept) ? unitKept : "auto";
  const [problem, setProblem] = useState<keyof typeof PROBLEMS | "">("");
  const [done, setDone] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [adminsOpen, setAdminsOpen] = useState(false);
  const [sending, startSending] = useTransition();

  const [typedIn, setTypedIn] = useState<Record<string, number>>({});
  const onText = useCallback((key: string, text: string, scale: number) => {
    setEdits((prev) => ({ ...prev, [key]: text }));
    setTypedIn((prev) => (prev[key] === scale ? prev : { ...prev, [key]: scale }));
    setDone("");
  }, []);
  const editing: Editing = { values, edits, typedIn, onText, crystal };
  /** Another unit for the crystal table: what was typed there keeps its worth (78 억 becomes 780,000 만). */
  const pickCrystal = (next: CrystalUnit) => {
    const texts = { ...edits };
    const scales = { ...typedIn };
    for (const cell of CELLS) {
      const text = edits[cell.key];
      if (cell.group !== "crystal" || text === undefined) continue;
      const current = numberAt(values, cell);
      const typed = parseNum(text, Number.NaN);
      const written = text.trim() !== "" && Number.isFinite(typed);
      const meso = written ? typed * unitOf(cell, current, editing).scale : current;
      const to = unitFor(cell, meso, next).scale;
      if (written) texts[cell.key] = String(typedOf(cell, meso, to));
      scales[cell.key] = to;
    }
    setEdits(texts);
    setTypedIn(scales);
    setCrystal(next);
  };

  const catalog = starItems(values);
  const itemGroups = useMemo(
    () => catalog.map((g) => ({ level: g.level, rows: g.items.map((it) => ({ cell: cellOf(`spare|${it.id}`)!, img: it.icons[0] ? itemImage(it.icons[0]) : undefined })) })),
    [catalog]
  );
  const itemCount = itemGroups.reduce((n, g) => n + g.rows.length, 0) + SETS.length + REWARDS.length;
  const worth = (cell: Cell) => `${num(typedOf(cell, numberAt(values, cell)))}억`;
  const searchRows = useMemo<RowHit[]>(
    () => [
      ...itemGroups.flatMap((g) => g.rows.map(({ cell, img }) => ({ key: cell.key, name: cell.name, group: `${g.level}제`, value: worth(cell), img }))),
      ...SETS.map((cell) => ({ key: cell.key, name: cell.name, group: "세트 장비", value: worth(cell) })),
      ...REWARDS.map(({ cell, img }) => ({ key: cell.key, name: cell.name, group: "보스 보상", value: worth(cell), img })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `worth` reads `values` only
    [itemGroups, values]
  );

  const byName = useMemo(() => new Map(dict.map((r) => [r.name, r])), [dict]);
  const changes = useMemo(() => {
    const out: Change[] = [];
    for (const cell of CELLS) {
      const text = edits[cell.key];
      if (text === undefined || text.trim() === "") continue;
      const current = numberAt(values, cell);
      const stored = storedOf(cell, parseNum(text, Number.NaN), unitOf(cell, current, { edits, typedIn, crystal }).scale);
      if (stored !== null && stored !== current) out.push({ key: cell.key, from: current, to: stored });
    }
    for (const [name, edit] of Object.entries(dictEdits)) {
      const row = byName.get(name);
      if (!row && !fresh.includes(name)) continue;
      const result = editedState(row ? stateOf(row) : null, edit, name);
      if ("bad" in result) continue;
      const from = row ? stateOf(row) : null;
      if (!sameDict(from, result.state)) out.push({ key: dictKey(name), from, to: result.state });
    }
    return out;
  }, [edits, typedIn, values, crystal, dictEdits, byName, fresh]);
  // A changed row is marked as looked at by the change itself.
  const marks = useMemo(() => {
    const changed = new Set(changes.map((c) => c.key));
    return checks.filter((name) => !changed.has(dictKey(name)));
  }, [checks, changes]);

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

  /** Moves to a cell (after the search list has closed and handed the focus back to its box). */
  const focusCell = (key: string) =>
    setTimeout(() => {
      const el = document.getElementById(fieldId(key)) as HTMLInputElement | null;
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
      el.select();
    }, 0);
  const goRow = (key: string) => {
    flushSync(() => setFilter(""));
    focusCell(key);
  };
  const goDict = (name: string) => {
    flushSync(() => {
      setDictQuery(name);
      setJump((n) => n + 1);
    });
    focusCell(dictKey(name));
  };

  const editDict = useCallback((name: string, patch: DictEdit) => {
    setDictEdits((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
    setDone("");
  }, []);
  const checkDict = useCallback((names: string[], on: boolean) => {
    setChecks((prev) => (on ? [...new Set([...prev, ...names])] : prev.filter((n) => !names.includes(n))));
    setDone("");
  }, []);
  const freshDict = useCallback((name: string, on: boolean) => {
    setFresh((prev) => (on ? [...prev.filter((n) => n !== name), name] : prev.filter((n) => n !== name)));
    if (!on) setDictEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([n]) => n !== name)));
  }, []);
  /** What 강화 기록 counts for an item that has no price of its own: its set's price (억), or nothing. */
  const inherited = useCallback(
    (name: string) => {
      const spare = knownItem(name, catalog, values)?.spare ?? 0;
      return spare > 0 ? spare / 1e8 : null;
    },
    [catalog, values]
  );

  const reset = () => {
    setEdits({});
    setDictEdits({});
    setChecks([]);
    setFresh([]);
    setProblem("");
  };
  const apply = () =>
    startSending(async () => {
      // What is sent, as it is now: a cell typed in while the request is on its way is not part of it and stays.
      const sent = new Set(changes.map((c) => c.key));
      const sentMarks = new Set(marks);
      const texts = edits;
      const rows = dictEdits;
      const result = await applySiteValues(note, changes, marks);
      if (result === "ok") {
        setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([key, text]) => !sent.has(key) || text !== texts[key])));
        setDictEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([name, edit]) => !sent.has(dictKey(name)) || edit !== rows[name])));
        setFresh((prev) => prev.filter((name) => !sent.has(dictKey(name))));
        setChecks((prev) => prev.filter((name) => !sentMarks.has(name) && !sent.has(dictKey(name))));
        setProblem("");
        setNote("");
        setDone([sent.size > 0 && `${sent.size}개 반영됨`, sentMarks.size > 0 && `확인 표시 ${sentMarks.size}줄`].filter(Boolean).join(" · "));
      } else setProblem(result);
    });

  const q = plainName(filter);
  const match = (name: string) => !q || plainName(name).includes(q);
  const shownGroups = itemGroups.map((g) => ({ ...g, rows: g.rows.filter((r) => match(r.cell.name)) })).filter((g) => g.rows.length > 0);
  const shownSets = SETS.filter((cell) => match(cell.name));
  const shownRewards = REWARDS.filter(({ cell }) => match(cell.name));
  const last = history[0];
  const SUMMARY = 3;
  const waiting = changes.length + marks.length;

  const bossRow = (b: (typeof BOSSES)[number], index: number) => (
    <div key={b.boss} className={cn(CRYSTAL_COLS, "items-center gap-2 rounded-[10px] px-2.5 py-1.5", index % 2 === 1 && "bg-background")}>
      {/* Stays at the left edge while the table is scrolled sideways (a phone), on the row's own fill. */}
      <span className={cn(stuck, "rounded-l-[10px]", index % 2 === 1 ? "bg-background" : "bg-card")}>
        <span className="truncate text-[13px] font-bold" data-tip={b.boss}>
          {b.boss}
        </span>
      </span>
      {b.cells.map((cell, i) =>
        cell ? (
          <CellField key={DIFFS[i]} cell={cell} label={`${cell.name} 결정석`} unit {...editing} />
        ) : (
          <span key={DIFFS[i]} aria-hidden="true" className="pr-7 text-right text-border">
            ·
          </span>
        )
      )}
    </div>
  );
  const itemLine = (cell: Cell, img: string | undefined, what: string) => (
    <ItemLine key={cell.key} fieldKey={cell.key} name={cell.name} img={img}>
      <CellField cell={cell} label={`${cell.name} ${what}, 억 메소`} {...editing} />
    </ItemLine>
  );

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
          { href: "#dict", name: "아이템 사전", count: dict.filter((r) => !r.blocked).length },
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
                <span className="min-h-4 text-xs text-primary-text">{lookOf(cell, current, edits[cell.key], cell.scale) === "changed" && `지금 ${num(current)}${cell.unit}`}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section id="crystal" className={cn(tile, "px-2 sm:px-3")}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-2">
          <Head className="min-w-0 flex-1 basis-60" title="보스 결정석 가격" sub={`${CRYSTAL_COUNT}칸`} right={`${age("crystal")} · 빈칸 = 그 난이도 없음`} />
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">적는 단위</span>
            <Segment
              label="결정석을 적는 단위"
              value={crystal}
              onChange={pickCrystal}
              options={CRYSTAL_UNITS}
              className="w-[216px]"
            />
          </div>
        </div>
        {/* The padding keeps a focus ring inside the scroll box; the negative margin gives its room back. */}
        <div className="-m-1 overflow-x-auto p-1">
          {/* Plain meso runs to thirteen characters: the table gets the room, and scrolls on a narrow screen. */}
          <div className={crystal === "메소" ? "min-w-[900px]" : "min-w-[780px]"}>
            <div className={cn(CRYSTAL_COLS, "gap-2 px-2.5 py-1.5 text-xs font-bold text-muted-foreground")}>
              <span className={cn(stuck, "bg-card")}>보스</span>
              {DIFFS.map((d) => (
                <span key={d} className="pr-7 text-right">
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
          <ItemSearch rows={searchRows} dict={dict} onGo={goRow} onDict={goDict} onFilter={setFilter} />
        </div>
        {q && shownGroups.length === 0 && shownSets.length === 0 && shownRewards.length === 0 && <p className="py-6 text-center text-[13px] text-muted-foreground">“{filter}”가 든 줄 없음</p>}
        {shownGroups.map((g) => (
          <Group key={g.level} label={`${g.level}제`}>
            {g.rows.map(({ cell, img }) => itemLine(cell, img, "노작값"))}
          </Group>
        ))}
        {shownSets.length > 0 && <Group label="세트 장비 · 강화 기록만 씀 (조각마다 값이 없을 때)">{shownSets.map((cell) => itemLine(cell, undefined, "노작값"))}</Group>}
        {shownRewards.length > 0 && <Group label="보스 보상 · 보스 수익만 씀">{shownRewards.map(({ cell, img }) => itemLine(cell, img, "가격"))}</Group>}
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

      <section id="dict" className={tile}>
        <DictSection
          key={jump}
          head={<Head title="아이템 사전" sub={`${dict.filter((r) => !r.blocked).length}줄`} right={age("dict")} below="방문자 브라우저가 올린 이름 · 레벨 · 그림 · 부위 — 강화 기록의 그림 · 레벨. 노작값을 적으면 강화 기록 · 기댓값 계산기 목록의 기본값" />}
          rows={dict}
          fresh={fresh}
          edits={dictEdits}
          checks={checks}
          query={dictQuery}
          onQuery={setDictQuery}
          onEdit={editDict}
          onCheck={checkDict}
          onFresh={freshDict}
          inherited={inherited}
        />
      </section>

      {(waiting > 0 || problem || done) && (
        // Only "n개 반영됨" to say: a small pill in the middle instead of the whole bar.
        <div className={cn("sticky bottom-4 z-20 mt-2 flex flex-col gap-2.5 rounded-2xl bg-popover px-4 py-3 text-popover-foreground shadow-lift sm:px-5", waiting === 0 && !problem && "w-fit self-center")}>
          {waiting > 0 ? (
            <>
              <p className="text-[13px] leading-relaxed text-pretty">
                <b className="text-primary-text">{[changes.length > 0 && `${changes.length}개 바뀜`, marks.length > 0 && `확인 표시 ${marks.length}줄`].filter(Boolean).join(" · ")}</b>
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
                  className={cn(textInput, "h-11 flex-1 basis-56 rounded-xl")}
                />
                <button type="button" onClick={reset} disabled={sending} className="h-11 rounded-xl px-4 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
                  되돌리기
                </button>
                <button type="button" onClick={apply} disabled={sending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold whitespace-nowrap text-primary-foreground disabled:opacity-60">
                  {sending && <Spinner />}
                  {waiting}개 반영하기
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
          <AdminList admins={admins} me={me} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Who may change the values. An owner adds a member by the address they sign in with, and takes editors out. */
function AdminList({ admins, me }: { admins: AdminRow[]; me: { id: string; owner: boolean } }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [said, setSaid] = useState<{ bad?: keyof typeof ADMIN_PROBLEMS; done?: string }>({});
  const [busy, start] = useTransition();
  // A second press takes an editor out: the first only asks.
  const [asking, setAsking] = useState("");
  const add = () =>
    start(async () => {
      const result = await addSiteAdmin(email, name);
      if (result === "ok") {
        setSaid({ done: `${name.trim()} 추가됨` });
        setEmail("");
        setName("");
      } else setSaid({ bad: result });
    });
  const remove = (id: string, who: string) =>
    start(async () => {
      const result = await removeSiteAdmin(id);
      setAsking("");
      setSaid(result === "ok" ? { done: `${who} 뺌` } : { bad: result });
    });
  return (
    <div className="flex flex-col gap-3" data-clarity-mask="true">
      <ul className="flex flex-col">
        {admins.map((a) => (
          <li key={a.id} className="flex min-h-11 items-center justify-between gap-3 border-t border-border py-1.5 first:border-t-0">
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-[13px]">
                {a.name || "이름 없음"}
                {a.id === me.id && <span className="font-medium text-muted-foreground"> · 나</span>}
              </b>
              <span className="text-xs text-muted-foreground">
                {a.role === "owner" ? "주인" : "편집"} · {kstDate(Date.parse(a.since))}부터
              </span>
            </span>
            {me.owner && a.role !== "owner" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => (asking === a.id ? remove(a.id, a.name) : setAsking(a.id))}
                onBlur={() => setAsking("")}
                className={cn("h-8 shrink-0 rounded-lg px-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-50", asking === a.id ? "bg-destructive/15 text-destructive" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
              >
                {asking === a.id ? "한 번 더 누르면 뺌" : "빼기"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {me.owner ? (
        <form
          className="flex flex-col gap-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <b className="text-[13px]">관리자 추가</b>
          <input aria-label="추가할 사람의 구글 이메일" type="email" required placeholder="구글 이메일 (한 번 로그인한 사람)" value={email} onChange={(e) => setEmail(e.target.value)} className={textInput} />
          <div className="flex gap-2">
            <input aria-label="기록에 남을 이름" required maxLength={40} placeholder="기록에 남을 이름" value={name} onChange={(e) => setName(e.target.value)} className={cn(textInput, "flex-1")} />
            <button type="submit" disabled={busy} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold whitespace-nowrap text-primary-foreground disabled:opacity-60">
              {busy && <Spinner />}
              추가
            </button>
          </div>
          <span className="text-xs text-pretty text-muted-foreground">추가한 사람 = 편집(값 고치기 · 반영). 관리자를 넣고 빼는 것은 주인만</span>
        </form>
      ) : (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">관리자를 넣고 빼는 것은 주인만</p>
      )}
      {said.bad && (
        <p role="alert" className="text-[13px] font-semibold text-destructive">
          {ADMIN_PROBLEMS[said.bad]}
        </p>
      )}
      {said.done && (
        <p role="status" className="text-[13px] font-bold">
          {said.done}
        </p>
      )}
    </div>
  );
}

/** The rows of one level, of the sets or of the boss rewards: one column on a phone, as many as fit from there. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <div className="grid grid-cols-1 gap-x-7 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">{children}</div>
    </div>
  );
}

/** One priced thing of the item part: picture, name, its price cell in 억. */
function ItemLine({ fieldKey, name, img, children }: { fieldKey: string; name: string; img?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-[52px] grid-cols-[32px_minmax(0,1fr)_104px_16px] items-center gap-2.5 border-t border-border">
      <Pic src={img} />
      <label htmlFor={fieldId(fieldKey)} className="truncate text-[13px] font-semibold" data-tip={name}>
        {name}
      </label>
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
      {below && <span className="text-[13px] text-pretty text-muted-foreground">{below}</span>}
    </div>
  );
}
