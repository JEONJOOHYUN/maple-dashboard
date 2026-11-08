import Link from "next/link";
import { ArrowRight, Sun, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { navGroups, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

const incomeFeatures = [
  {
    title: "캡처 한 장으로 기록",
    description: "인벤토리 [기타] 탭을 붙여넣으면 사냥으로 얻는 메소 · 솔 에르다 조각이 채워져요",
  },
  {
    title: "0에서 시작하면 끝",
    description: "메소 · 조각을 비우고 사냥 → 끝나고 들고 있는 게 오늘 번 돈 · 주간 · 월간으로 모아 봐요",
  },
  {
    title: "보스 수익은 자동으로 빼기",
    description: "API 키가 있으면 오늘 판 결정석을 스케줄러로 찾아 사냥 수익에서 빼요",
  },
  {
    title: "여러 계정 묶어 보기",
    description: "API 키를 여러 개 등록하면 계정별로 캐릭터를 묶어요",
  },
];

const incomeSteps = [
  { title: "0으로 비우고 사냥", description: "메소 · 조각을 옮겨 두고 시작" },
  { title: "캡처 붙여넣기", description: "끝나면 인벤토리 [기타] 탭을 Ctrl+V" },
  { title: "확인 · 저장", description: "읽은 숫자를 보고 저장" },
];

const primaryButton = cn(buttonVariants(), "h-[42px] rounded-lg px-[18px] text-sm font-bold");

export default function Home() {
  return (
    <div className="flex flex-col gap-4 lg:gap-[22px]">
      {/* This week: guest state (login arrives in stage 3). */}
      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-5 py-[18px]">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <h1 className="font-heading text-base font-bold">이번 주 내 메이플</h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            로그인하면 남은 숙제와 내 수익이 여기 보여요. API 키만 넣어도 이번 주 보스 수익은 로그인 없이 볼 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/revenue"
            className={cn(buttonVariants({ variant: "secondary" }), "h-[42px] rounded-lg border-border px-4 text-sm font-normal")}
          >
            API 키로 보스 수익만 보기
          </Link>
          <Link href="/login" className={primaryButton}>
            로그인
          </Link>
        </div>
      </section>

      <Link
        href="/sunday"
        className="flex flex-wrap items-center gap-3.5 rounded-lg border border-border bg-card px-[18px] py-3.5 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
          <Sun className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="flex min-w-[180px] flex-1 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">오늘 썬데이 메이플</span>
          <b className="text-sm">썬데이 혜택 모아 보기를 준비하고 있어요</b>
        </span>
        <span className="text-xs font-semibold text-primary-text">준비 중 →</span>
      </Link>

      <section className="flex flex-col gap-4 rounded-lg border border-primary bg-card p-5 lg:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-2 text-[13px] font-bold text-primary-text">
              <Wallet className="size-4" aria-hidden="true" />
              내 수익
            </span>
            <h2 className="font-heading text-[22px] leading-snug font-bold lg:text-[26px]">
              오늘 번 메소, 캡처 한 장이면 기록돼요
            </h2>
          </div>
          <Link href="/income" className={primaryButton}>
            내 수익 시작하기
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {incomeFeatures.map((f) => (
            <div key={f.title} className="flex flex-col gap-1.5 rounded-lg bg-muted p-3.5">
              <b className="text-sm">{f.title}</b>
              <span className="text-xs leading-normal text-muted-foreground">{f.description}</span>
            </div>
          ))}
        </div>
        <ol className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
          {incomeSteps.map((s, i) => (
            <li key={s.title} className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-3">
              <b className="font-num text-[22px] font-bold text-primary-text">{i + 1}</b>
              <span className="flex flex-col gap-0.5">
                <b className="text-sm">{s.title}</b>
                <span className="text-xs text-muted-foreground">{s.description}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {navGroups.map((group) => {
        const cards = group.items.filter((item) => item.card);
        if (cards.length === 0) return null;
        return (
          <section key={group.id} aria-label={group.label} className="flex flex-col gap-2.5">
            <h2 className="font-heading text-base font-bold">{group.label}</h2>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((item) => (
                <ToolCard key={item.slug} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ToolCard({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="group flex flex-col gap-2.5 rounded-lg border border-border bg-card p-[18px] transition-colors outline-none hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="flex items-center gap-1.5">
          {item.needs && <span className="text-xs text-muted-foreground">{item.needs}</span>}
          {!item.ready && (
            <Badge variant="outline" className="text-muted-foreground">
              준비 중
            </Badge>
          )}
        </span>
      </span>
      <b className="text-base">{item.card?.title}</b>
      <span className="text-[13px] leading-normal text-muted-foreground">{item.card?.description}</span>
      {item.ready && (
        <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary-text">
          열기 <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      )}
    </Link>
  );
}
