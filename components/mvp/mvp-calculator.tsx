"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Chip, NumberField, Segment, parseNum } from "@/components/ev/ui";
import { CREDIT_PCT, CREDIT_SHOP, GIFT_WON_PER_10K, MESO_MARKET_MP, MVP_ITEMS, MVP_MESO_WON, MVP_METHODS } from "@/lib/ev/defaults";
import {
  MESO_SELL_KEEP,
  MVP_TIERS,
  addDays,
  auctionWon,
  chargePlan,
  creditWorth,
  msToDeadline,
  nextTierOf,
  sellRoute,
  tierOf,
  weekList,
  type Market,
  type MvpTier,
  type Route,
} from "@/lib/mvp";
import { useNow } from "@/lib/use-now";
import { useStored } from "@/lib/use-stored";
import { cn } from "@/lib/utils";
import { koreanUnits } from "@/lib/format";

const man = (won: number) => `${(Math.round(won / 1000) / 10).toLocaleString("ko-KR")}만`;
const won = (v: number) => `${koreanUnits(v, Infinity)}원`;
const num = (v: number) => koreanUnits(v, Infinity);
const md = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const mdw = (day: string) => `${md(day)}(${DOW[new Date(`${day}T00:00:00Z`).getUTCDay()]})`;

type Item = { id: string; name: string; cash: string; price: string };
type ShopItem = { id: string; name: string; credit: string; price: string };
type Settings = {
  discounts: Record<string, string>;
  wonRate: string;
  mmRate: string;
  giftRate: string;
  fee: 3 | 5;
  useCredit: boolean;
  creditNow: string;
  items: Item[];
  shop: ShopItem[];
  /** "next" = up to the next grade, a grade name = up to that grade, "custom" = the amount typed. */
  target: string;
  custom: string;
  /** Grade input (user, 2026-11-09: no weekly chart): the 13-week total now and what drops out next Thursday. */
  sum13: string;
  drop: string;
};
const DEFAULT_SETTINGS: Settings = {
  discounts: Object.fromEntries(MVP_METHODS.map((m) => [m.id, String(m.discountPct)])),
  wonRate: String(MVP_MESO_WON),
  mmRate: String(MESO_MARKET_MP),
  giftRate: String(GIFT_WON_PER_10K),
  fee: 3,
  useCredit: true,
  creditNow: "",
  items: MVP_ITEMS.map((i) => ({ id: i.id, name: i.name, cash: String(i.cash), price: String(i.auctionEok) })),
  shop: CREDIT_SHOP.map((i) => ({ id: i.id, name: i.name, credit: String(i.credit), price: String(i.auctionEok) })),
  target: "next",
  custom: "",
  sum13: "",
  drop: "",
};
const ROUTE_LABEL: Record<Route["mode"], string> = { best: "최저가 · 추천", mm: "전부 메소마켓", gift: "선물식" };

function TierDot({ tier }: { tier: MvpTier | null }) {
  return <span className="inline-block size-3.5 shrink-0 rounded-full ring-1 ring-border" style={{ background: tier ? tier.color : "var(--border)" }} />;
}

function Stat({ label, big, sub, accent }: { label: string; big: ReactNode; sub: ReactNode; accent?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-lg border px-4 py-3.5", accent ? "border-primary bg-primary-soft" : "border-border bg-card")}>
      <span className={cn("text-xs", accent ? "font-semibold text-primary-text" : "text-muted-foreground")}>{label}</span>
      <b className="flex items-center gap-2 text-[22px] leading-tight">{big}</b>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

/** One setting: name on the left, control on the right, always 40 px high. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-background pr-1 pl-3 text-[13px] text-muted-foreground">
      <span className="truncate">{label}</span>
      {children}
    </span>
  );
}

/** A labelled row: the label sits in its own column on wide screens so every row lines up. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-start">
      <span className="text-[13px] font-semibold sm:pt-2.5">{label}</span>
      {children}
    </div>
  );
}

function Toggle<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <span role="radiogroup" aria-label={label} className="inline-flex gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "h-8 rounded-md px-3 text-[13px]",
            value === o.id ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export function MvpCalculator() {
  const now = useNow();
  // New shape (2026-11-09 restructure) under a new key so old saved numbers do not mix in.
  const [settings, setSettings] = useStored<Settings>("mvp:settings2", DEFAULT_SETTINGS);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", cash: "", price: "" });
  const [shopDraft, setShopDraft] = useState({ name: "", credit: "", price: "" });

  const s = { ...DEFAULT_SETTINGS, ...settings };
  const update = (patch: Partial<Settings>) => setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...patch }));

  if (now === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="MVP 계산기" description="등급 = 최근 13주 결제 합계 · 수요일 23:59 마감, 목요일 반영" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  const { current } = weekList(now);
  // Grade from the two numbers people know: the 13-week total and the week that drops out next Thursday.
  const sumNow = Math.max(0, Math.round(parseNum(s.sum13, 0)));
  const sumNext = Math.max(0, sumNow - Math.round(parseNum(s.drop, 0)));
  const up = nextTierOf(sumNext);
  const base = { sumNow, sumNext, now: tierOf(sumNow), up, need: up ? up.min - sumNext : 0 };
  const nextThu = addDays(current, 7);
  const left = msToDeadline(now);
  const days = Math.floor(left / 86400_000);
  const hours = Math.floor((left % 86400_000) / 3600_000);
  const mins = Math.floor((left % 3600_000) / 60_000);

  // How much to pay this week.
  const above = MVP_TIERS.filter((t) => t.min > base.sumNext);
  const payFor = (target: string) => {
    if (target === "custom") return Math.max(0, Math.round(parseNum(s.custom, 0)));
    if (target === "next") return Math.max(0, base.need);
    const t = MVP_TIERS.find((x) => x.name === target);
    return t ? Math.max(0, t.min - base.sumNext) : 0;
  };
  const target = s.target === "next" || s.target === "custom" || above.some((t) => t.name === s.target) ? s.target : "next";
  const pay = payFor(target);
  const afterTier = tierOf(sumNext + pay);

  // Charging, then selling back.
  const methods = MVP_METHODS.map((m) => ({ ...m, discountPct: parseNum(s.discounts[m.id] ?? String(m.discountPct), 0) }));
  const plan = chargePlan(pay, methods);
  const market: Market = {
    wonPer100m: parseNum(s.wonRate, MVP_MESO_WON),
    mpPer100m: parseNum(s.mmRate, MESO_MARKET_MP),
    auctionFeePct: s.fee,
    giftWonPer10k: parseNum(s.giftRate, GIFT_WON_PER_10K),
    // Fixed in game: 5 % of cash spent comes back as credit.
    creditPct: CREDIT_PCT,
    useCredit: s.useCredit,
    creditNow: parseNum(s.creditNow, 0),
  };
  const items = s.items.map((it) => ({ id: it.id, name: it.name, cash: parseNum(it.cash, 0), eok: parseNum(it.price, 0) }));
  const shop = s.shop.map((it) => ({ id: it.id, name: it.name, credit: parseNum(it.credit, 0), eok: parseNum(it.price, 0) }));
  const routes = (["best", "mm", "gift"] as const).map((mode) => sellRoute(plan.charged, pay, mode, items, shop, market));
  const net = (r: Route) => plan.pay - r.won;
  const best = routes[0];

  // Ranking: won back per 10,000 cash, credit included when it is on.
  const cw = market.useCredit ? creditWorth(shop, market) : 0;
  const bonus = market.useCredit ? (10_000 * market.creditPct) / 100 * cw : 0;
  const rows = [
    ...s.items.map((it, i) => {
      const it2 = items[i];
      const base10k = it2.cash > 0 ? (auctionWon(it2.eok, market) / it2.cash) * 10_000 : 0;
      return { kind: "item" as const, id: it.id, item: it, base10k, total: base10k > 0 ? base10k + bonus : 0 };
    }),
    { kind: "mm" as const, id: "mm", item: null, base10k: market.mpPer100m > 0 ? ((market.wonPer100m * MESO_SELL_KEEP) / market.mpPer100m) * 10_000 : 0, total: 0 },
    { kind: "gift" as const, id: "gift", item: null, base10k: market.giftWonPer10k, total: market.giftWonPer10k },
  ];
  rows[rows.length - 2].total = rows[rows.length - 2].base10k + bonus;
  rows.sort((a, b) => b.total - a.total);
  const top = Math.max(1, ...rows.map((r) => r.total));
  const pga = rows.find((r) => r.id === "pga" && r.total > 0) ?? rows.find((r) => r.kind === "mm");
  const ratio = (v: number) => (pga && pga.total > 0 && v > 0 ? (v / pga.total).toFixed(2) : "—");

  const setItem = (id: string, patch: Partial<Item>) => update({ items: s.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const setShop = (id: string, patch: Partial<ShopItem>) => update({ shop: s.shop.map((x) => (x.id === id ? { ...x, ...patch } : x)) });


  const chargeText = methods
    .filter((m) => plan.takes[m.id])
    .map((m) => `${m.name} ${man(plan.takes[m.id])}`)
    .join(" · ");

  /** One step per line; `sub` = small second line (credit purchases), so long lists never wrap mid-sentence. */
  function steps(r: Route): { text: string; sub?: string }[] {
    const out: { text: string; sub?: string }[] = [];
    out.push({ text: `충전: ${chargeText || "—"} (현금 ${won(plan.pay)})` });
    for (const it of r.items) out.push({ text: `${it.name} × ${num(it.count)} → 경매장 → ${won(it.won)}` });
    if (r.mm.cash) out.push({ text: `메소마켓: ${num(r.mm.cash)}포인트 → ${koreanUnits(r.mm.eok * 1e8)} 메소 → ${won(r.mm.won)}` });
    if (r.gift.cash) out.push({ text: `캐시 ${man(r.gift.cash)} 선물 → ${won(r.gift.won)}` });
    if (market.useCredit && r.mode !== "gift" && r.credit.total > 0) {
      const buys = r.credit.buys.map((b) => `${b.name} × ${b.count}`).join(" · ");
      // Split only when credit was already there; "30,000 (이번에 30,000)" just repeated itself.
      const had = r.credit.total - r.credit.earned;
      const from = had > 0 && r.credit.earned > 0 ? ` (보유 ${num(had)} + 적립 ${num(r.credit.earned)})` : "";
      out.push(
        buys
          ?{ text: `크레딧 ${num(r.credit.total)}${from} → ${won(r.credit.won)}`, sub: buys }
          : { text: `크레딧 ${num(r.credit.total)}${from} → 살 것 없음` },
      );
    }
    return out;
  }

  /** Side notes under the steps (not steps themselves). */
  function notes(r: Route): string[] {
    const out: string[] = [];
    if (r.mode === "gift" && market.useCredit) out.push("선물 캐시는 크레딧 적립 없음");
    if (r.leftover > 0) out.push(`남는 캐시 ${num(r.leftover)}`);
    if (r.approx) out.push("600만 원 넘음 → 근삿값");
    return out;
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <PageHeader title="MVP 계산기" description="등급 = 최근 13주 결제 합계 · 수요일 23:59 마감, 목요일 반영" />

      <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card px-4 py-3.5">
          <span className="text-xs text-muted-foreground">지금 등급</span>
          <b className="flex items-center gap-2 text-[22px] leading-tight">
            <TierDot tier={base.now} />
            {base.now?.name ?? "등급 없음"}
          </b>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            13주 합계
            <NumberField label="지금 13주 합계 (원)" value={s.sum13} onChange={(t) => update({ sum13: t })} suffix="원" inputClassName="h-7 w-24 text-xs" />
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            다음 주에 빠짐
            <NumberField label="다음 목요일에 빠지는 주의 금액 (원)" value={s.drop} onChange={(t) => update({ drop: t })} suffix="원" inputClassName="h-7 w-24 text-xs" />
          </span>
        </div>
        <Stat label="이번 주 마감까지" big={<span className="font-num">{days > 0 ? `${days}일 ${hours}시간` : `${hours}시간 ${mins}분`}</span>} sub={`${mdw(addDays(current, 6))} 23:59`} />
        <Stat
          label="이번 주 결제"
          big={<span className="font-num">{won(pay)}</span>}
          sub={pay > 0 ? `${mdw(nextThu)}부터 ${afterTier?.name ?? "등급 없음"}` : "결제 금액 선택"}
        />
        <Stat
          accent
          label="실제로 나가는 돈 · 최저가"
          big={<span className="font-num">{pay > 0 ? won(net(best)) : "—"}</span>}
          sub={pay > 0 ? `회수율 ${((best.won / Math.max(1, plan.pay)) * 100).toFixed(1)}% · 경매장 판매 ${num(best.sales)}회` : "—"}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <Row label="결제 금액">
          <div className="flex flex-wrap gap-2">
            {above.map((t) => (
              <Chip key={t.name} on={target === t.name || (target === "next" && base.up?.name === t.name)} onClick={() => update({ target: t.name })} className="h-10">
                <span className="inline-flex items-center gap-1.5">
                  <TierDot tier={t} />
                  {t.name}까지 <span className="font-num text-muted-foreground">{man(t.min - base.sumNext)}</span>
                </span>
              </Chip>
            ))}
            <span className={cn("inline-flex h-10 items-center gap-2 rounded-lg border pr-1 pl-3 text-[13px]", target === "custom" ? "border-primary bg-primary-soft" : "border-border")}>
              직접
              <NumberField label="결제할 금액 직접 입력 (원)" value={s.custom} onChange={(t) => update({ custom: t, target: "custom" })} suffix="원" inputClassName="h-8 w-28" />
            </span>
          </div>
        </Row>
        <Row label="시세">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="메소 1억">
              <NumberField label="메소 시세 (1억당 원)" value={s.wonRate} onChange={(t) => update({ wonRate: t })} suffix="원" inputClassName="h-8 w-20" />
            </Field>
            <Field label="메소마켓 1억">
              <NumberField label="메소마켓 (1억당 메이플포인트)" value={s.mmRate} onChange={(t) => update({ mmRate: t })} suffix="메포" inputClassName="h-8 w-20" />
            </Field>
            <Field label="선물식 1만 캐시">
              <NumberField label="선물식 1만 캐시당 받는 돈 (원)" value={s.giftRate} onChange={(t) => update({ giftRate: t })} suffix="원" inputClassName="h-8 w-20" />
            </Field>
            <Field label="경매장 수수료">
              <Toggle
                label="경매장 수수료"
                value={String(s.fee) as "3" | "5"}
                onChange={(v) => update({ fee: v === "5" ? 5 : 3 })}
                options={[
                  { id: "3", label: "3%" },
                  { id: "5", label: "5%" },
                ]}
              />
            </Field>
          </div>
        </Row>
        <Row label="충전">
          <div className="flex flex-col gap-2">
            <div className="flex min-h-10 flex-wrap items-center justify-between gap-2">
              <span className="text-[13px]">{chargeText ? `${chargeText} → 현금 ${won(plan.pay)}` : "—"}</span>
              <button
                type="button"
                aria-expanded={chargeOpen}
                onClick={() => setChargeOpen(!chargeOpen)}
                className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-[13px] hover:border-primary/60"
              >
                할인율 {chargeOpen ? "접기" : "고치기"}
              </button>
            </div>
            {chargeOpen && (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {methods.map((m) => (
                  <Field key={m.id} label={m.name}>
                    <NumberField
                      label={`${m.name} 할인 %`}
                      value={s.discounts[m.id] ?? String(m.discountPct)}
                      onChange={(t) => update({ discounts: { ...s.discounts, [m.id]: t } })}
                      decimal
                      suffix="%"
                      inputClassName="h-8 w-14"
                    />
                  </Field>
                ))}
              </div>
            )}
          </div>
        </Row>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-2">
          <b className="text-[15px]">효율 순위 · 1만원당 돌려받는 돈</b>
          {market.useCredit && <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">크레딧 포함</span>}
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="w-16 px-4 py-2 text-left font-normal whitespace-nowrap">순위</th>
                <th scope="col" className="px-2 py-2 text-left font-normal">아이템</th>
                <th scope="col" className="px-2 py-2 text-right font-normal">캐시가</th>
                <th scope="col" className="px-2 py-2 text-right font-normal">경매장 가격</th>
                <th scope="col" className="px-2 py-2 text-left font-normal">1만원당</th>
                <th scope="col" className="px-2 py-2 text-right font-normal">플가 대비</th>
                <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">빼기</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={cn("border-t border-border", i === 0 && r.total > 0 && "bg-primary-soft")}>
                  <td className="px-4 py-2.5">
                    <b className={cn("font-num text-lg", i === 0 ? "text-primary-text" : "text-muted-foreground")}>{i + 1}</b>
                  </td>
                  <td className="px-2 py-2.5">
                    {r.kind === "item" ? (
                      <b>{r.item!.name}</b>
                    ) : r.kind === "mm" ? (
                      <b>메소마켓</b>
                    ) : (
                      <b>선물식</b>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {r.kind === "item" ? (
                      <NumberField label={`${r.item!.name} 캐시 가격`} value={r.item!.cash} onChange={(t) => setItem(r.id, { cash: t })} className="justify-end" inputClassName="h-8 w-20 text-xs" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {r.kind === "item" ? (
                      <NumberField label={`${r.item!.name} 경매장 가격 (억)`} value={r.item!.price} onChange={(t) => setItem(r.id, { price: t })} decimal suffix="억" className="justify-end" inputClassName="h-8 w-16 text-xs" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{r.kind === "mm" ? `1억 = ${s.mmRate}메포` : `1만 캐시 = ${num(market.giftWonPer10k)}원`}</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <span className="h-2.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-muted">
                        <span className={cn("block h-full rounded-full", i === 0 ? "bg-primary" : "bg-primary/55")} style={{ width: `${Math.round((r.total / top) * 100)}%` }} />
                      </span>
                      <b className="w-20 text-right font-num">{r.total > 0 ? won(r.total) : "가격 필요"}</b>
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right font-num">{ratio(r.total)}</td>
                  <td className="px-2 py-2.5 text-right">
                    {r.kind === "item" && (
                      <button
                        type="button"
                        aria-label={`${r.item!.name} 빼기`}
                        onClick={() => update({ items: s.items.filter((x) => x.id !== r.id) })}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">아이템 추가</span>
          <input
            aria-label="추가할 아이템 이름"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value.slice(0, 30) })}
            placeholder="플래티넘 애플"
            className="h-9 w-40 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-ring"
          />
          <NumberField label="추가할 아이템 캐시 가격" value={draft.cash} onChange={(t) => setDraft({ ...draft, cash: t })} suffix="캐시" inputClassName="w-20" />
          <NumberField label="추가할 아이템 경매장 가격 (억)" value={draft.price} onChange={(t) => setDraft({ ...draft, price: t })} decimal suffix="억" inputClassName="w-16" />
          <button
            type="button"
            disabled={!draft.name.trim()}
            onClick={() => {
              update({ items: [...s.items, { id: `c-${crypto.randomUUID()}`, name: draft.name.trim(), cash: draft.cash, price: draft.price }] });
              setDraft({ name: "", cash: "", price: "" });
            }}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
          >
            추가
          </button>
          {MVP_ITEMS.filter((p) => !s.items.some((it) => it.id === p.id)).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => update({ items: [...s.items, { id: p.id, name: p.name, cash: String(p.cash), price: String(p.auctionEok) }] })}
              className="h-8 rounded-full border border-dashed border-border px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              + {p.chip}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b className="text-[15px]">메이플 크레딧</b>
          <Segment
            label="크레딧 쓰기"
            value={s.useCredit ? "on" : "off"}
            onChange={(v) => update({ useCredit: v === "on" })}
            options={[
              { id: "on", label: "크레딧 쓰기" },
              { id: "off", label: "안 쓰기" },
            ]}
            className="w-52"
          />
        </div>
        {s.useCredit && (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="지금 남은 크레딧">
                <NumberField label="지금 남은 크레딧" value={s.creditNow} onChange={(t) => update({ creditNow: t })} inputClassName="h-8 w-24" />
              </Field>
            </div>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-[13px]">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th scope="col" className="py-2 text-left font-normal">크레딧샵 물건</th>
                    <th scope="col" className="px-2 py-2 text-right font-normal">크레딧</th>
                    <th scope="col" className="px-2 py-2 text-right font-normal">경매장 가격</th>
                    <th scope="col" className="px-2 py-2 text-right font-normal">크레딧 1만당</th>
                    <th scope="col" className="w-10 py-2"><span className="sr-only">빼기</span></th>
                  </tr>
                </thead>
                <tbody>
                  {s.shop.map((it, i) => {
                    const c = shop[i];
                    const per = c.credit > 0 ? (auctionWon(c.eok, market) / c.credit) * 10_000 : 0;
                    const isTop = per > 0 && per >= cw * 10_000 - 1e-6;
                    return (
                      <tr key={it.id} className="border-t border-border">
                        <td className="py-2">
                          <b>{it.name}</b>
                          {isTop && <span className="ml-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">가장 효율</span>}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <NumberField label={`${it.name} 크레딧`} value={it.credit} onChange={(t) => setShop(it.id, { credit: t })} className="justify-end" inputClassName="h-8 w-20 text-xs" />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <NumberField label={`${it.name} 경매장 가격 (억)`} value={it.price} onChange={(t) => setShop(it.id, { price: t })} decimal suffix="억" className="justify-end" inputClassName="h-8 w-16 text-xs" />
                        </td>
                        <td className="px-2 py-2 text-right font-num">{per > 0 ? won(per) : "—"}</td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            aria-label={`${it.name} 빼기`}
                            onClick={() => update({ shop: s.shop.filter((x) => x.id !== it.id) })}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-3.5" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">크레딧샵 물건 추가</span>
              <input
                aria-label="추가할 크레딧샵 물건 이름"
                value={shopDraft.name}
                onChange={(e) => setShopDraft({ ...shopDraft, name: e.target.value.slice(0, 30) })}
                placeholder="물건 이름"
                className="h-9 w-36 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-ring"
              />
              <NumberField label="추가할 물건 크레딧" value={shopDraft.credit} onChange={(t) => setShopDraft({ ...shopDraft, credit: t })} suffix="크레딧" inputClassName="w-20" />
              <NumberField label="추가할 물건 경매장 가격 (억)" value={shopDraft.price} onChange={(t) => setShopDraft({ ...shopDraft, price: t })} decimal suffix="억" inputClassName="w-16" />
              <button
                type="button"
                disabled={!shopDraft.name.trim()}
                onClick={() => {
                  update({ shop: [...s.shop, { id: `s-${crypto.randomUUID()}`, name: shopDraft.name.trim(), credit: shopDraft.credit, price: shopDraft.price }] });
                  setShopDraft({ name: "", credit: "", price: "" });
                }}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
              >
                추가
              </button>
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <b className="text-[15px]">어떻게 결제할까 · 루트 3개 비교</b>
          {pay > 0 && (
            <span className="text-xs text-muted-foreground">
              {won(pay)} 결제 · 충전에 현금 {won(plan.pay)}
              {plan.charged > pay ? ` (5만원권이라 ${man(plan.charged)} 충전)` : ""}
            </span>
          )}
        </div>
        {pay === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">위에서 결제 금액 선택</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {routes.map((r) => {
              const isBest = r.mode === "best";
              const diff = net(r) - net(best);
              return (
                <div key={r.mode} className={cn("flex min-w-0 flex-col gap-2.5 rounded-lg border bg-card p-4", isBest ? "border-primary" : "border-border")}>
                  <span className={cn("text-xs font-semibold", isBest ? "text-primary-text" : "text-muted-foreground")}>{ROUTE_LABEL[r.mode]}</span>
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <b className="font-num text-[28px] leading-none">{won(net(r))}</b>
                    <span className="text-xs text-muted-foreground">실제 부담</span>
                    {!isBest && diff > 0.5 && <span className="text-xs font-semibold text-destructive">최저가보다 +{won(diff)}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    회수 {won(r.won)} ({((r.won / Math.max(1, plan.pay)) * 100).toFixed(1)}%)
                    {r.sales ? ` · 경매장 판매 ${num(r.sales)}회` : ""}
                  </span>
                  {r.short > 0 && (
                    <span className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive">
                      등급까지 {won(r.short)} 부족 · 캐시 추가 필요
                    </span>
                  )}
                  <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[13px] leading-relaxed">
                    {steps(r).map((t) => (
                      <li key={t.text}>
                        {t.text}
                        {t.sub && <span className="block text-xs text-muted-foreground">{t.sub}</span>}
                      </li>
                    ))}
                  </ol>
                  {notes(r).length > 0 && (
                    <span className="text-xs text-muted-foreground">{notes(r).join(" · ")}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>


    </div>
  );
}
