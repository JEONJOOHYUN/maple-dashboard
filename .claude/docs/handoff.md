# maple-dashboard — 프로젝트 핸드오프 문서

메이플스토리 부주(mule) 사냥 수익 정산 및 누적 대시보드. 여러 메이플 관련 도구를
탭으로 얹을 수 있게 설계된 독립 Next.js 프로젝트. (기존 포트폴리오 프로젝트는
`C:\dev\portfolio`로 분리되어 있고, 이 프로젝트와는 완전히 별개.)

- GitHub: https://github.com/JEONJOOHYUN/maple-dashboard (public)
- Vercel: 프로젝트 `maple-dashboard`, 배포 URL https://maple-dashboard-eta.vercel.app
- Supabase: 프로젝트 id `dwxntehggzojbzbeydxm`, region `ap-northeast-2` (Seoul), Free/NANO tier
  (약 1주 미사용 시 자동 일시정지됨 — 오랜만에 접속하면 첫 요청이 느릴 수 있음)

## 기술 스택

- Next.js 16.3.1 (App Router, Turbopack), React 19.2.8, TypeScript
- Tailwind CSS v4 (`@custom-variant dark (&:where(.dark, .dark *))`), `next-themes` (다크모드)
- **shadcn/ui** (style `base-nova`, Base UI 기반) — `components.json`, `components/ui/*`에 소스가
  복사되는 방식. 현재 `Button`, `Input`을 정산 계산기/일일 기록 폼에서 사용.
  클래스 병합은 `cn` 패키지(`lib/utils.ts`가 re-export). 새 컴포넌트는
  `npx shadcn@latest add <name>`으로 추가.
  주의 1: `shadcn init`이 `app/globals.css`와 `app/layout.tsx`를 덮어쓰면서 Geist 폰트를
  넣어버렸던 적이 있어, 로컬 Paperlogy 폰트와 slate 배경/오렌지 primary 토큰은 수동으로
  되돌려놨습니다. shadcn CLI를 다시 돌릴 때는 두 파일의 diff를 꼭 확인하세요.
  주의 2 (다크모드 버그): `globals.css`에서 **`:root`(라이트)가 반드시 `.dark`보다 먼저**
  와야 합니다. 두 셀렉터는 명시도가 같아서 순서가 뒤집히면 `.dark`가 `:root`에 덮여
  다크모드에서 배경/글자색이 라이트 값 그대로 남습니다 (shadcn init이 실제로 이 순서를
  뒤집어 놓은 적 있음).
- Supabase(Postgres) — `@supabase/supabase-js`, **서버 사이드에서만** 사용 (Server Components / Server Actions).
  `SUPABASE_URL` / `SUPABASE_ANON_KEY` (NEXT_PUBLIC_ 접두어 아님 — 클라이언트에 노출 안 됨)
- 데이터 mutation은 전부 Server Actions(`"use server"`)로만 처리. 클라이언트 fetch/API route 없음.
- 캐싱: `unstable_cache`로 읽기 캐시 + `updateTag`로 Server Action 안에서 즉시 무효화
  (Cache Components 신모델이 아니라 "Previous Model" 유지 — 영향 범위를 좁게 가져가기 위한 의도적 선택)
- 이 Next 버전은 학습 데이터보다 최신이라 `node_modules/next/dist/docs/`를 직접 참고해야 함 (AGENTS.md 참고)

### 중요 인프라 이슈: 리전 문제 (해결됨)

부주 정산 페이지가 항상 느렸던 원인은 Vercel 서버리스 함수가 미국 리전에서 실행되고
Supabase는 서울(ap-northeast-2)에 있어서 매 요청마다 태평양을 왕복한 것 (`x-vercel-id`
헤더로 `icn1::iad1::...` 확인해서 진단). `vercel.json`에 `{"regions": ["icn1"]}`을
추가해 함수를 서울에 고정 → 1100~1700ms에서 95~374ms로 개선, 이후 `unstable_cache` +
`updateTag` 캐싱 레이어(`lib/queries.ts`) 추가로 51~75ms까지 개선.

## 디렉터리 구조

```
maple-dashboard/
  app/
    layout.tsx              # 루트 레이아웃: Paperlogy 폰트, ThemeProvider, 헤더+NavTabs
    page.tsx                 # 홈 — 도구 카드 목록 (lib/tools.ts 기반)
    globals.css
    icon.jpg / apple-icon.jpg / opengraph-image.jpg  # 버섯 마스코트 브랜딩
    actions/
      workers.ts             # addWorker, renameWorker, deleteWorker
    settlement/
      page.tsx                # 부주 선택 + 데이터 로드(캐시 경유), SettlementClient 렌더
      settlement-client.tsx   # 정산 도구 메인 클라이언트 컴포넌트 (가장 크고 자주 수정된 파일)
      actions.ts               # upsertLog, deleteLog, settleUp, deleteSettlement
    boss-split/
      page.tsx                # 보스 분배금 계산기 (DB 없음, 완전 클라이언트 사이드)
    admin/
      page.tsx                 # 쿠키 체크 → 로그인 폼 or 대시보드
      actions.ts                # adminLogin/adminLogout, updateLog, updateSettlement
      admin-dashboard.tsx        # 부주/기록/정산 전체 테이블, 인라인 편집
      admin-login-form.tsx
      admin-add-worker-form.tsx
  components/
    nav-tabs.tsx              # 상단 탭 네비게이션 (헤더와 같은 max-w-5xl 컨테이너로 정렬)
    worker-tabs.tsx            # 부주 선택 탭 + "+ 부주 추가" 인라인 폼
    theme-provider.tsx / theme-toggle.tsx
    icon-value.tsx              # 아이콘+숫자 표시 헬퍼
    activity-calendar.tsx        # 일별 조각/메소 아이콘 달력, 월별 합계
  lib/
    supabase.ts               # supabase 클라이언트 + Worker/HuntingLog/Settlement 타입
    queries.ts                  # getWorkers(), getWorkerData(workerId), workerTag() — unstable_cache 래핑
    settlement-math.ts           # computeSettlement(...)
    boss-split-math.ts            # computeBossSplit(...) — chuchu.gg 알고리즘 재현
    format.ts                     # formatNumber, formatKrw, formatCompactMeso, formatKoreanMeso
    meso-input.ts                  # 콤마 포맷 + 캐럿 위치 유지 입력 핸들러
    constants.ts                    # AUCTION_HOUSE_FEE_RATE = 0.03
    tools.ts                         # 홈 카드 + NavTabs가 공유하는 도구 목록
  components/ui/             # shadcn/ui 컴포넌트 (button, input) — 직접 수정 가능
  supabase/
    schema.sql                # 최신 전체 스키마 (신규 설치용)
    migrations/
      002_add_workers.sql      # workers 테이블 추가, worker_id FK 추가, 기존 데이터 "승환"으로 backfill
      003_add_incentive_meso.sql # settlements.incentive_meso 컬럼 추가
      004_add_fragment_sales.sql # fragment_sales 테이블 추가 (조각 → 메소 전환 기록)
  vercel.json                # {"regions": ["icn1"]} — Supabase와 같은 리전 고정
  .env.local                 # 실제 값 (gitignored)
  .env.local.example          # 키 이름만 문서화 (플레이스홀더)
```

워크스페이스 공유 launch.json: `C:\dev\.claude\launch.json`
```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "portfolio-dev", "runtimeExecutable": "npm", "runtimeArgs": ["--prefix", "portfolio", "run", "dev"], "port": 3000 },
    { "name": "maple-dashboard-dev", "runtimeExecutable": "npm", "runtimeArgs": ["--prefix", "maple-dashboard", "run", "dev"], "port": 3001 }
  ]
}
```

## DB 스키마 (Supabase Postgres)

모든 테이블 RLS 활성화 + 완전 허용 정책(`using(true) with check(true)`) — 개인용 툴이고
`/admin`만 비밀번호로 보호하는 구조라 의도적으로 이렇게 설정.

```sql
create table if not exists workers (
  id bigint generated always as identity primary key,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table workers enable row level security;
create policy "Allow all access to workers" on workers for all using (true) with check (true);

create table if not exists hunting_logs (
  id bigint generated always as identity primary key,
  worker_id bigint not null references workers(id) on delete cascade,
  log_date date not null,
  pure_meso bigint not null default 0,
  fragment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (worker_id, log_date)
);
alter table hunting_logs enable row level security;
create policy "Allow all access to hunting_logs" on hunting_logs for all using (true) with check (true);

create table if not exists fragment_sales (
  id bigint generated always as identity primary key,
  worker_id bigint not null references workers(id) on delete cascade,
  sold_at timestamptz not null default now(),
  fragment_count integer not null,
  fragment_price bigint not null,
  gross_meso bigint not null,
  fee_meso bigint not null,
  net_meso bigint not null
);
alter table fragment_sales enable row level security;
create policy "Allow all access to fragment_sales" on fragment_sales for all using (true) with check (true);
create index if not exists fragment_sales_worker_id_idx on fragment_sales (worker_id);

create table if not exists settlements (
  id bigint generated always as identity primary key,
  worker_id bigint not null references workers(id) on delete cascade,
  settled_at timestamptz not null default now(),
  fragment_price bigint not null,
  cash_rate bigint not null,
  fragment_count bigint not null,
  pure_meso bigint not null,
  fee_meso bigint not null,
  incentive_meso bigint not null default 0,
  total_meso bigint not null,
  krw_value bigint not null
);
alter table settlements enable row level security;
create policy "Allow all access to settlements" on settlements for all using (true) with check (true);
```

- `workers`: 부주 목록. `sort_order`로 탭 정렬. 실제 데이터에 "승환"이라는 부주가 있고
  (마이그레이션 002가 기존 레코드를 이 이름으로 backfill), UI에서 언제든 추가 가능.
- `hunting_logs`: 부주별 하루 사냥 기록(순수 메소, 솔 에르다 조각 개수). `(worker_id, log_date)`
  유니크. 기본 저장 동작은 **기존 값에 더하기**(하루에 여러 세션으로 나눠 사냥 가능하므로),
  "수정하기" 버튼으로 명시적 덮어쓰기 모드 전환 가능.
- `fragment_sales`: **조각 → 메소 전환** 기록. 경매장 시세로 조각을 팔면 한 행이 쌓이고,
  판매 수량만큼 누적 조각이 줄고 수수료 3%를 뗀 `net_meso`만큼 누적 순수 메소가 늘어납니다.
- `settlements`: **메소 → 현금 정산** 스냅샷 — 그 시점의 시세/현금화 비율/정산한 순수 메소/
  인센티브/합계 메소/KRW 환산액을 기록. `fragment_count`, `fee_meso`는 조각 판매가 분리되기
  전(2026-09-04 이전) 행과의 호환용이며 새 정산은 0으로 저장됩니다.

**누적 계산식** (settlement-client.tsx):
```
누적 조각 = Σ logs.fragment_count − Σ fragment_sales.fragment_count − Σ settlements.fragment_count(구버전)
누적 메소 = Σ logs.pure_meso + Σ fragment_sales.net_meso − Σ settlements.pure_meso
```

## 핵심 로직

- **정산 계산** (`lib/settlement-math.ts`): `computeSettlement(fragmentCount, pureMeso,
  fragmentPrice, cashRate, incentiveMeso=0)` → 조각을 가격×현금화비율로 환산한 총 메소에서
  경매장 수수료 3%(`AUCTION_HOUSE_FEE_RATE`)를 떼고, 순수 메소·인센티브 메소를 더해 최종
  합계 메소와 KRW 환산액 산출.
- **보스 분배금** (`lib/boss-split-math.ts`, chuchu.gg 리버스 엔지니어링): 파티장은 2차
  수수료를 내지 않고, 파티원 몫은 `(1 - feeRate)`로 나눠서(재판매/양도 시 세금 반영) 역산.
  아이템 여러 개 등록 시 총액을 합산한 뒤 분배.
- **캐싱** (`lib/queries.ts`): `getWorkers()`는 태그 `"workers"`, `getWorkerData(workerId)`는
  태그 `` `worker-${workerId}` ``로 5분(`revalidate: 300`) 캐시. 모든 mutation Server Action이
  끝나면 관련 태그를 `updateTag()`로 즉시 무효화 + `/admin` 페이지는 `revalidatePath`.

## 관리자 페이지 (`/admin`)

- 비밀번호는 `ADMIN_PASSWORD` 환경변수로만 관리 (현재 값 `0321`, 코드/저장소에 하드코딩 금지).
- httpOnly 쿠키에 비밀번호를 저장해 로그인 상태 유지, `adminLogout`으로 해제.
- 부주 이름 변경/삭제, 일일 기록 전체 수정/삭제, 정산 내역 전체 수정(인센티브 포함)/삭제 가능.
- 앞으로 새 도구가 추가되면 이 admin 대시보드도 확장하는 것이 원칙.

## 환경변수 (`.env.local`, gitignored — 실제 값은 절대 커밋 금지)

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
ADMIN_PASSWORD=
```
`.env.local.example`에 키 이름만 플레이스홀더로 문서화되어 있음. Vercel 프로젝트 설정에도
동일한 3개 환경변수가 등록되어 있어야 배포본이 정상 동작함.

## 지금까지 만든 기능 (탭)

1. **부주 정산** (`/settlement`)
   - 부주 탭 전환 (부주별로 독립된 데이터), "+ 부주 추가"
   - 일일 사냥 기록 입력(순수 메소 + 조각 개수), 기본은 해당 날짜 기존 값에 **더하기**
   - "수정하기" 버튼: 클릭 시 선택된 날짜에 저장된 값을 폼에 불러와서 그 값 기준으로 수정 →
     저장 시 덮어쓰기(overwrite)로 처리. "취소"로 원래(더하기) 모드 복귀.
   - 일일 기록 테이블은 5개씩 페이지네이션(클라이언트 사이드).
   - 실시간 시세 연동 계산기는 **2단계**로 분리되어 있습니다:
     1. **조각 판매** (오렌지 강조 블록): 판매할 조각 개수(비우면 전량) × 조각 가격 → 수수료 3%
        차감 → `fragment_sales`에 insert. 누적 조각이 줄고 누적 메소가 늘어납니다.
     2. **현금 정산**: 보유 메소 + 인센티브 메소 → 현금화 비율로 KRW 환산 → `settlements`에
        insert. 누적 메소에서 정산액이 빠집니다.
   - 숫자 입력은 전부 `number | ""` 상태로 관리합니다. 빈 칸을 0으로 되돌리면 "0이 안 지워지는"
     컨트롤드 인풋 버그가 생기므로, 절대 `Number(e.target.value)`만 쓰지 말 것
     (`numberInputHandler` 헬퍼 사용).
2. **보스 분배금** (`/boss-split`, DB 미사용)
   - https://chuchu.gg/simulators/boss-profit 과 동일한 산식 재현.
   - 아이템 여러 개 등록 가능(각각 콤마 포맷 입력) → 합산 후 분배.
   - 총 판매액/실수령액 표시(4억7500만 메소 같은 한글 단위 포함), 수수료 %, 멤버 균등/자율 분배,
     "결과 복사" 버튼(`이름 : 정수` 형식으로 클립보드 복사).
3. **관리자 페이지** (`/admin`) — 위 설명 참고.

## 작업 방식 관례

- 기능 추가 후에는 실제(또는 안전하게 되돌릴 수 있는) Supabase 데이터로 Browser 도구를 통해
  직접 검증한 뒤에만 커밋.
- 커밋/푸시는 사용자가 명시적으로 "푸시해"라고 할 때만 수행.
- 스키마 변경은 항상 `supabase/migrations/`에 멱등성 있는(idempotent) SQL 파일로 남기고,
  사용자가 실제 프로덕션 DB에 직접 실행 확인 후 관련 기능을 사용.
