# maple-dashboard — 구조 참고

> handoff 에서 떼어 낸 참고 자료(2026-10-29). 파일·테이블을 바꾸면 여기도 고친다. 지금 상태는 [handoff.md](handoff.md).

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
      005_add_log_entries.sql    # log_entries 테이블 + hunting_logs_audit 트리거 (일일 기록 변경 이력)
  vercel.json                # {"regions": ["icn1"]} — Supabase와 같은 리전 고정
  .env.local                 # 실제 값 (gitignored)
  .env.local.example          # 키 이름만 문서화 (플레이스홀더)
```

미리보기 서버 설정은 워크스페이스 공유 `C:dev.claudelaunch.json` 의 `maple-dashboard-dev`(포트 3001).

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
- `log_entries`: 일일 기록의 변경 이력. `hunting_logs`에 트리거(`hunting_logs_audit`)를
  걸어 INSERT/UPDATE/DELETE마다 변동분(delta)을 남깁니다. 날짜당 한 행에 값을 더하거나
  덮어쓰는 구조라 "언제 얼마를 더했는지"가 남지 않던 문제를 보완한 것이며, 앱·관리자
  페이지·SQL 어디서 바꾸든 모두 기록됩니다. 조회 실패해도 페이지가 깨지지 않도록
  `getWorkerData`에서 비치명적으로 처리합니다.
- `settlements`: **메소 → 현금 정산** 스냅샷 — 그 시점의 시세/현금화 비율/정산한 순수 메소/
  인센티브/합계 메소/KRW 환산액을 기록. `fragment_count`, `fee_meso`는 조각 판매가 분리되기
  전(2026-09-04 이전) 행과의 호환용이며 새 정산은 0으로 저장됩니다.

**누적 계산식** (settlement-client.tsx):
```
누적 조각 = Σ logs.fragment_count − Σ fragment_sales.fragment_count − Σ settlements.fragment_count(구버전)
누적 메소 = Σ logs.pure_meso + Σ fragment_sales.net_meso − Σ settlements.pure_meso
```
