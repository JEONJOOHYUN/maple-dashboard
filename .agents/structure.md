# maple-dashboard — 구조 참고

> handoff 에서 떼어 낸 참고 자료(2026-10-29). 파일·테이블을 바꾸면 여기도 고친다. 지금 상태는 [handoff.md](handoff.md).

> **2026-11-11**: 옛 관리자 · 정산 코드를 지웠다 — `app/admin` · `app/actions` · `app/settlement` · `lib/queries.ts` · `lib/settlement-math.ts` · `lib/constants.ts` · `lib/date.ts` · `components/worker-tabs.tsx` · `icon-value.tsx` · `activity-calendar.tsx` · `ui/alert-dialog.tsx` · `public/meso.png` · `fragment.png`. 새로 생긴 것 = `app/privacy/page.tsx`, `supabase/migrations/008_drop_legacy_tables.sql`(옛 표 5개 삭제, 운영 배포 뒤 실행). 아래 목록 · 스키마의 해당 줄은 옛 내용이고, "파일 정리" 단계에서 새 구조로 다시 쓴다.

## 디렉터리 구조

```
maple-dashboard/
  app/
    layout.tsx              # 루트 레이아웃: Pretendard(fonts/Pretendard CSS import) + 메이플스토리 서체(숫자 전용 font-num), ThemeProvider, SideNav + SiteHeader, Clarity
    page.tsx                 # 홈 — 비회원 "이번 주" + 썬데이 카드(lib/sunday/view.ts, 1시간마다 다시 계산) + 내 수익 소개 + 도구 카드(lib/nav.ts)
    [tool]/page.tsx          # 아직 없는 도구·로그인의 "준비 중" 페이지(generateStaticParams, 그 밖은 404)
    globals.css
    icon.png (512, 배경 투명 · 버섯만) / apple-icon.png (180, 정사각형 배경 #1D1C19)  # 2026-11-10 새 버섯 아이콘. 원본 1254px C:/dev/_work/maple-icon/icon-source.png(git 밖)
    opengraph-image.jpg      # 링크 미리보기 그림 — 아직 옛 버섯 마스코트
    actions/
      workers.ts             # addWorker, renameWorker, deleteWorker
    settlement/
      page.tsx                # 부주 선택 + 데이터 로드(캐시 경유), SettlementClient 렌더
      settlement-client.tsx   # 정산 도구 메인 클라이언트 컴포넌트 (가장 크고 자주 수정된 파일)
      actions.ts               # upsertLog, deleteLog, settleUp, deleteSettlement
    boss-split/
      page.tsx                # 보스 분배금 계산기 (DB 없음, 완전 클라이언트 사이드)
    enhance/actions.ts        # 공용 아이템 사전 서버 액션: lookupItems · reportItems (아이템 사실만, 횟수 제한)
    enhance/page.tsx          # 강화 기록 → components/enhance/enhance-app.tsx (브라우저에서만 동작, 상세 .agents/enhance.md)
    ev/page.tsx               # 기댓값 계산기 → components/ev/ev-calculator.tsx (5탭)
    mvp/page.tsx              # MVP 계산기 → components/mvp/mvp-calculator.tsx
    pinball/page.tsx          # 핀볼 추첨 → components/pinball/pinball-game.tsx
    spec/page.tsx             # 숨은 스펙업(서버): ?name= → lib/spec/load.ts getSpec → components/spec/spec-check.tsx
    sunday/page.tsx           # 썬데이 메이플(서버, 요청마다 렌더링 — 월요일 0시 KST 전환): lib/sunday/view.ts getSundayPageData → components/sunday/sunday-view.tsx
    admin/
      page.tsx                 # 쿠키 체크 → 로그인 폼 or 대시보드
      actions.ts                # adminLogin/adminLogout, updateLog, updateSettlement
      admin-dashboard.tsx        # 부주/기록/정산 전체 테이블, 인라인 편집
      admin-login-form.tsx
      admin-add-worker-form.tsx
  components/
    side-nav.tsx              # 데스크톱 왼쪽 메뉴(lg 이상)
    site-header.tsx            # 머리줄(경로 · 테마 · 로그인) + 모바일 묶음 탭/아래 탭
    brand.tsx                 # 로고 = public/brand-mark.png(app/icon.png 96px 사본, 정적 import + unoptimized) + 사이트 이름
    page-header.tsx / clarity.tsx
    worker-tabs.tsx            # 부주 선택 탭 + "+ 부주 추가" 인라인 폼
    theme-provider.tsx / theme-toggle.tsx
    icon-value.tsx              # 아이콘+숫자 표시 헬퍼
    activity-calendar.tsx        # 일별 조각/메소 아이콘 달력, 월별 합계
    enhance/                  # 강화 기록: enhance-app(키 관문) · key-gate · starforce-board(기간 · 요약 · 탭) · starforce-views(보기 4개 + 아이템 창) · potential-board(잠재능력 탭) · board-bits(두 보드 공용: 기간 · 받기 · 탭) · parts(공용 · 배지 · 선택 상자) · use-item-dict(공용 아이템 사전 조회 · 올리기) · use-worlds(잠재능력 기록의 월드 추정)
    ev/                       # 기댓값 탭 5개(starforce · potential · flame · soul · ability) + ui.tsx(칩 · 세그먼트 · 결과 카드 등 공용)
    mvp/ · pinball/           # MVP · 핀볼 화면
    spec/spec-check.tsx       # 숨은 스펙업 검색 · 결과(배지 열고 닫기, 놓친 스펙 · 참고 목록)
    sunday/sunday-view.tsx    # 썬데이 화면(서버 컴포넌트만): 가로 띠(이번 주 혜택 · 테마 타일 · 혜택 5개 · 샤이닝/미라클 예상) · 혜택별 확률(테마별 묶음) · 최근 썬데이, ThemeChip(홈도 씀)
  lib/
    supabase.ts               # supabase 클라이언트 + Worker/HuntingLog/Settlement 타입
    queries.ts                  # getWorkers(), getWorkerData(workerId), workerTag() — unstable_cache 래핑
    settlement-math.ts           # computeSettlement(...)
    boss-split-math.ts            # computeBossSplit(...) — chuchu.gg 알고리즘 재현
    format.ts                     # formatNumber, formatKrw, formatCompactMeso, formatKoreanMeso
    meso-input.ts                  # 콤마 포맷 + 캐럿 위치 유지 입력 핸들러
    constants.ts                    # AUCTION_HOUSE_FEE_RATE = 0.03
    nav.ts                           # 메뉴 묶음·도구 목록(아이콘·홈 카드 문구·준비 중 여부) — 메뉴·홈이 공유
    ev/                               # 기댓값 계산 함수(starforce · potential · flame · soul · ability · luck) + *.test.ts, data/(공식 확률표 JSON), defaults.ts(가격 기본값 + 날짜)
    enhance/                          # 강화 기록: 스타포스 parse · judge(손익) · stats(집계) · items(레벨 / 노작), 잠재능력 potential · pot-stats, kst + *.test.ts, 브라우저 전용 client(넥슨 직접 호출) · idb · sync · 공용 아이템 사전 dict(검사 · 올릴 것 고르기, 브라우저 · 서버 공용) + dict-server(서버 전용: item_dict 읽기 캐시 · 저장) · worlds(월드 3묶음 · 캐릭터가 그때 있던 월드) + test
    mvp.ts (+ test)                   # MVP 등급 · 주차(목~수, KST) · 충전 계획 · 되팔기 효율
    pinball/                          # lazygyu roulette 엔진(MIT, LICENSE 사본) 정리본 + 우리 코스 stage.ts
    nexon/api.ts                      # 넥슨 Open API 서버 전용 호출(NEXON_API_KEY, 호출 간격 220ms, 429 한 번 재시도, 오류 종류 noKey · notFound · quota · failed)
    spec/                             # 숨은 스펙업: check.ts(규칙 · 보스 프리셋 판별, 순수 함수) + test, load.ts(API 15회 → 3시간 캐시), data/classes.json(직업별 기준, 만드는 법 _work/maple-spec-probe)
    sunday/                           # 썬데이: bundles.ts(묶음 · 테마 3개), history.ts(기록 읽기 · 한국 시간 날짜), predict.ts(예측) + test, view.ts(화면 데이터), data/history.json · benefits.json(만드는 법 _work/maple-sunday-data)
                                      # 자동 갱신(서버): notice.ts(넥슨 공지 찾기) · notice-parse.ts + test, ocr.ts(CLOVA OCR 호출) · ocr-lines.ts(글자 상자 → 줄) + test, match.ts(줄 → 혜택, "확인 필요") + test · match.fixtures.json, ignored.ts(기록 안 함), auto-update.ts(읽기 묶음),
                                      # 저장: stored.ts(저장 규칙) + test, store.ts(sunday_weeks 쓰기 · 실행 기록), live.ts(화면용 읽기) ← app/api/cron/sunday/route.ts
    use-stored.ts / use-now.ts        # 비회원 브라우저 저장(localStorage) / 30초 시계
    empty-module.ts                   # box2d-wasm 의 fs·path 를 브라우저에서 비우는 별칭(next.config.ts)
  components/ui/             # shadcn/ui 컴포넌트 (button, input, badge, alert-dialog) — 직접 수정 가능
  fonts/Maplestory/          # 넥슨 공식 OTF 그대로 + LICENSE.md
  fonts/Pretendard/          # 공식 가변 동적 서브셋(92조각) + LICENSE.txt(OFL)
  supabase/
    schema.sql                # 최신 전체 스키마 (신규 설치용)
    migrations/
      002_add_workers.sql      # workers 테이블 추가, worker_id FK 추가, 기존 데이터 "승환"으로 backfill
      003_add_incentive_meso.sql # settlements.incentive_meso 컬럼 추가
      004_add_fragment_sales.sql # fragment_sales 테이블 추가 (조각 → 메소 전환 기록)
      005_add_log_entries.sql    # log_entries 테이블 + hunting_logs_audit 트리거 (일일 기록 변경 이력)
      006_add_sunday_weeks.sql   # sunday_weeks(썬데이 자동 갱신 결과) + sunday_cron_runs(Cron 실행 기록), 권한(GRANT) 명시
      009_add_item_dict.sql      # item_dict(공용 아이템 사전: 이름 → 레벨 · 아이콘 코드 · 부위), 읽기 누구나 · 쓰기 서버 전용 키 — 2026-11-12 실행됨
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
- `sunday_weeks`(006, 2026-11-10 실행): 썬데이 한 주 = 한 행(`sunday` 가 키). `status` auto · confirmed 만 공개(누구나 읽기), review 는 서버 전용 키만. 쓰기는 서버 전용 키만(`lib/sunday/store.ts`). 열 설명은 SQL 파일 주석.
- `sunday_cron_runs`(006): Cron 실행 한 번 = 한 행(언제 · 어느 주 · 결과 · 걸린 시간). 읽기 · 쓰기 모두 서버 전용 키만.
- `settlements`: **메소 → 현금 정산** 스냅샷 — 그 시점의 시세/현금화 비율/정산한 순수 메소/
  인센티브/합계 메소/KRW 환산액을 기록. `fragment_count`, `fee_meso`는 조각 판매가 분리되기
  전(2026-09-04 이전) 행과의 호환용이며 새 정산은 0으로 저장됩니다.

**누적 계산식** (settlement-client.tsx):
```
누적 조각 = Σ logs.fragment_count − Σ fragment_sales.fragment_count − Σ settlements.fragment_count(구버전)
누적 메소 = Σ logs.pure_meso + Σ fragment_sales.net_meso − Σ settlements.pure_meso
```

## 기술 스택

- Next.js 16.4.3 (App Router, Turbopack), React 19.2.8, TypeScript. 이 Next 버전은 학습 데이터보다 최신 → `node_modules/next/dist/docs/` 를 직접 참고.
- Tailwind CSS v4 (`@custom-variant dark (&:where(.dark, .dark *))`), `next-themes` (다크모드).
- 글꼴 = Pretendard(`fonts/Pretendard/`) + 큰 숫자만 메이플스토리 서체(`fonts/Maplestory/`, `font-num`).
- **shadcn/ui** (style `base-nova`, Base UI 기반) — `components/ui/*`, 새 컴포넌트는 `npx shadcn@latest add <name>`.
  주의: `shadcn init` 이 `app/globals.css` · `app/layout.tsx` 를 덮어쓴 적 있음(Geist 폰트) → CLI 뒤 두 파일 diff 확인. `globals.css` 에서 **`:root`(라이트)가 반드시 `.dark` 보다 먼저**(명시도가 같아 순서가 뒤집히면 다크모드가 라이트 색으로 남음).
- Supabase(Postgres) — `@supabase/supabase-js`, **서버에서만**(Server Components / Server Actions), `SUPABASE_URL` / `SUPABASE_ANON_KEY`(NEXT_PUBLIC_ 아님). 데이터 변경은 전부 Server Actions, 클라이언트 fetch/API route 없음.
- 캐싱: `unstable_cache` + `updateTag`("Previous Model" 유지, 의도적 선택). 시간에 따라 바뀌는 페이지(썬데이 · 홈)는 `await connection()` 으로 요청마다 렌더링 + DB 행만 `unstable_cache`(2026-11-11, 월요일 0시 전환).
- Vercel 함수 리전 `icn1` 고정(`vercel.json`).
- 환경변수(`.env.local`, gitignored, 값은 출력 · 커밋 · 문서 기록 금지): `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `ADMIN_PASSWORD`(코드에서 안 씀, 운영 배포 뒤 사용자가 삭제) · `NEXON_API_KEY`. 키 이름은 `.env.local.example`.
