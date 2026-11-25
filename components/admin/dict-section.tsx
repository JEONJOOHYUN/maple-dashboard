"use client";

import { useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Ban, Check, ImageOff, Plus, Search, Undo2, X } from "lucide-react";
import { Pic } from "@/components/admin/item-search";
import { NumberField } from "@/components/ev/ui";
import { MenuSelect } from "@/components/ui/menu-select";
import { Pager, usePage } from "@/components/pager";
import { iconUrl, plainName } from "@/lib/enhance/dict";
import { num } from "@/lib/site-values/describe";
import { canPrice, dictKey, editedState, sameDict, stateOf, type DictEdit, type DictRow } from "@/lib/site-values/dict-edit";
import { extraTip } from "@/lib/tip";
import { cn } from "@/lib/utils";

// The shared item dictionary on the admin page: every row visitors' browsers sent (name · level · icon · part), to
// look through, correct, price or block. Nothing is written here: the parent keeps what is typed and the bar at
// the bottom applies it with everything else.

type Status = "all" | "unchecked" | "priced" | "noicon" | "blocked";
const PAGE = 30;
const FIELD_BAD = "border-destructive text-destructive";
const FIELD_ON = "border-primary text-primary-text ring-1 ring-primary";
const iconButton = "relative grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground after:absolute after:-inset-1 hover:bg-muted hover:text-foreground";

/** A row's icon button, named in the site's bubble (components/tip-layer.tsx) on hover or keyboard focus. */
function IconButton({ tip, className, ...props }: ComponentProps<"button"> & { tip: string }) {
  return <button type="button" {...extraTip(tip)} {...props} className={cn(iconButton, className)} />;
}

export function DictSection({
  head,
  rows,
  fresh,
  edits,
  checks,
  query,
  onQuery,
  onEdit,
  onCheck,
  onFresh,
  inherited,
}: {
  head: ReactNode;
  rows: DictRow[];
  /** Names typed in here that the dictionary does not have yet. */
  fresh: string[];
  edits: Record<string, DictEdit>;
  /** Names marked as looked at, waiting to be applied. */
  checks: string[];
  query: string;
  onQuery: (text: string) => void;
  onEdit: (name: string, patch: DictEdit) => void;
  onCheck: (names: string[], on: boolean) => void;
  onFresh: (name: string, on: boolean) => void;
  /** The price (억) 강화 기록 uses for an item that has none of its own: its set's, or null. */
  inherited: (name: string) => number | null;
}) {
  const [status, setStatus] = useState<Status>("all");
  const [part, setPart] = useState("");
  const [level, setLevel] = useState("");
  const top = useRef<HTMLDivElement>(null);

  const open = useMemo(() => rows.filter((r) => !r.blocked), [rows]);
  const parts = useMemo(() => [...new Set(open.map((r) => r.part).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")), [open]);
  const levels = useMemo(() => [...new Set(open.map((r) => r.level))].sort((a, b) => a - b), [open]);
  const partOptions = useMemo(() => [{ value: "", label: "모든 부위" }, ...parts.map((p) => ({ value: p, label: p }))], [parts]);
  const levelOptions = useMemo(() => [{ value: "", label: "모든 레벨" }, ...levels.map((l) => ({ value: String(l), label: `${l}제` }))], [levels]);
  const counts: Record<Status, number> = {
    all: open.length,
    unchecked: open.filter((r) => !r.checked).length,
    priced: open.filter((r) => r.spareEok !== null).length,
    noicon: open.filter((r) => !r.icon).length,
    blocked: rows.length - open.length,
  };

  const q = plainName(query);
  const list = useMemo(
    () =>
      rows.filter(
        (r) =>
          (status === "blocked" ? r.blocked : !r.blocked) &&
          (status !== "unchecked" || !r.checked) &&
          (status !== "priced" || r.spareEok !== null) &&
          (status !== "noicon" || !r.icon) &&
          (!part || r.part === part) &&
          (!level || r.level === Number(level)) &&
          (!q || plainName(r.name).includes(q))
      ),
    [rows, status, part, level, q]
  );
  const pager = usePage(`${status}|${part}|${level}|${q}`, list.length, PAGE);
  const page = list.slice(pager.from, pager.to);
  const pending = page.filter((r) => !r.checked && !checks.includes(r.name)).map((r) => r.name);
  const typed = query.trim();
  const canAdd = typed.length > 0 && typed.length <= 60 && !rows.some((r) => r.name === typed) && !fresh.includes(typed);

  const line = (name: string, row: DictRow | null) => {
    const edit = edits[name] ?? {};
    const result = editedState(row && stateOf(row), edit, name);
    const bad = "bad" in result ? result.bad : [];
    const changed = "state" in result && (!row || !sameDict(stateOf(row), result.state));
    const blocked = edit.blocked ?? row?.blocked ?? false;
    const icon = edit.icon ?? row?.icon ?? "";
    const marked = row?.checked || checks.includes(name);
    const priceable = canPrice(name);
    const usual = inherited(name);
    // Orange = this field would change. An emptied level changes nothing (the level stays); an emptied price does.
    const on = (field: keyof DictEdit, was: unknown) => {
      if (bad.includes(field)) return FIELD_BAD;
      const text = edit[field] === undefined ? null : String(edit[field]).trim();
      return text !== null && !(field === "level" && text === "") && text !== String(was ?? "") && FIELD_ON;
    };
    return (
      <div key={name} className={cn("grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-2 border-t border-border py-2 lg:grid-cols-[32px_minmax(0,1fr)_84px_120px_132px_100px] lg:py-1.5", blocked && "opacity-60")}>
        <Pic src={iconUrl(icon) || undefined} />
        <span className="flex min-w-0 flex-col">
          <b className={cn("truncate text-[13px] font-semibold", blocked && "line-through")} data-tip={name}>
            {name}
          </b>
          <span className="truncate text-xs text-muted-foreground">
            {!row ? "새 아이템 · 레벨을 적어야 반영" : [changed && "고치는 중", row.checked ? "확인함" : checks.includes(name) ? "확인 표시 대기" : "아직 안 봄", !priceable && "가격 = 위 아이템 목록"].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="flex items-center justify-end gap-0.5 lg:order-last">
          {row && !row.checked && (
            <IconButton tip="확인함" aria-pressed={checks.includes(name)} aria-label={`${name} 확인함`} onClick={() => onCheck([name], !checks.includes(name))} className={cn(marked && "text-primary-text")}>
              <Check className="size-4" aria-hidden="true" />
            </IconButton>
          )}
          {icon && (
            <IconButton tip="그림 지우기" aria-label={`${name} 그림 지우기`} onClick={() => onEdit(name, { icon: "" })}>
              <ImageOff className="size-4" aria-hidden="true" />
            </IconButton>
          )}
          {row ? (
            <IconButton tip={blocked ? "막기 풀기" : "막기 · 사전에서 빼고 다시 못 올라오게"} aria-pressed={blocked} aria-label={blocked ? `${name} 막기 풀기` : `${name} 막기`} onClick={() => onEdit(name, { blocked: !blocked })}>
              {blocked ? <Undo2 className="size-4" aria-hidden="true" /> : <Ban className="size-4" aria-hidden="true" />}
            </IconButton>
          ) : (
            <IconButton tip="넣지 않기" aria-label={`${name} 넣지 않기`} onClick={() => onFresh(name, false)}>
              <X className="size-4" aria-hidden="true" />
            </IconButton>
          )}
        </span>
        {/* Three cells under the name on a phone, beside it from lg. */}
        <div className="col-span-3 grid grid-cols-[72px_minmax(0,1fr)_112px] gap-2 lg:contents">
          <NumberField
            label={`${name} 레벨`}
            value={edit.level ?? (row ? String(row.level) : "")}
            onChange={(text) => onEdit(name, { level: text })}
            placeholder={row ? String(row.level) : "레벨"}
            suffix="제"
            className="flex min-w-0 whitespace-nowrap"
            inputClassName={cn("w-full", on("level", row?.level))}
          />
          <input
            aria-label={`${name} 부위`}
            value={edit.part ?? row?.part ?? ""}
            onChange={(e) => onEdit(name, { part: e.target.value })}
            placeholder="부위"
            maxLength={20}
            // 16px on a phone: a smaller input makes iOS zoom the page in on focus.
            className={cn("h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 sm:text-[13px]", on("part", row?.part))}
          />
          <NumberField
            id={`v-${dictKey(name)}`}
            label={`${name} 노작값, 억 메소`}
            value={priceable ? (edit.spare ?? (row?.spareEok === null || !row ? "" : String(row.spareEok))) : ""}
            onChange={(text) => onEdit(name, { spare: text })}
            placeholder={!priceable ? "목록 값" : usual !== null ? num(usual) : "없음"}
            decimal
            suffix="억"
            disabled={!priceable}
            className="flex min-w-0 whitespace-nowrap"
            inputClassName={cn("w-full disabled:opacity-50", on("spare", row?.spareEok))}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      <div ref={top} className="scroll-mt-4">
        {head}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 basis-48 items-center gap-2 rounded-lg border border-border bg-background px-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 sm:max-w-[280px]">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input id="dict-search" aria-label="사전에서 이름으로 찾기" placeholder="이름" value={query} onChange={(e) => onQuery(e.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-base outline-none sm:text-[13px]" />
          {query && (
            <button type="button" aria-label="검색 지우기" onClick={() => onQuery("")} className="relative grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground after:absolute after:-inset-1.5 hover:text-foreground">
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </label>
        <MenuSelect label="부위" value={part} onChange={setPart} options={partOptions} className="h-9 rounded-lg" />
        <MenuSelect label="레벨" value={level} onChange={setLevel} options={levelOptions} className="h-9 rounded-lg" />
      </div>
      <div role="radiogroup" aria-label="보기" className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", "전체"],
            ["unchecked", "안 본 것"],
            ["priced", "가격 있음"],
            ["noicon", "그림 없음"],
            ["blocked", "막은 것"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={status === id}
            onClick={() => setStatus(id)}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap", status === id ? "bg-foreground font-bold text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
          >
            {label} <span className={cn("font-num text-xs", status !== id && "text-muted-foreground")}>{counts[id]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col">
        <div className="hidden grid-cols-[32px_minmax(0,1fr)_84px_120px_132px_100px] gap-x-2.5 pb-1.5 text-xs font-bold text-muted-foreground lg:grid">
          <span />
          <span>이름</span>
          <span>레벨</span>
          <span>부위</span>
          <span>노작값</span>
          <span />
        </div>
        {fresh.map((name) => line(name, null))}
        {page.map((row) => line(row.name, row))}
        {list.length === 0 && fresh.length === 0 && <p className="border-t border-border py-6 text-center text-[13px] text-muted-foreground">맞는 줄 없음</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {pending.length > 0 && (
            <button type="button" onClick={() => onCheck(pending, true)} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] tile-edge bg-background px-3 text-[13px] font-bold whitespace-nowrap">
              <Check className="size-4" aria-hidden="true" /> 이 쪽 {pending.length}줄 확인함
            </button>
          )}
          {canAdd && (
            <button
              type="button"
              onClick={() => onFresh(typed, true)}
              className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-[10px] border border-dashed border-border px-3 text-[13px] font-bold text-muted-foreground hover:border-primary/60 hover:text-foreground"
            >
              <Plus className="size-4 shrink-0" aria-hidden="true" /> <span className="truncate">“{typed}” 새 아이템으로 넣기</span>
            </button>
          )}
        </div>
        <Pager page={pager.page} pages={pager.pages} onPage={pager.go} anchor={top} />
      </div>
    </>
  );
}
