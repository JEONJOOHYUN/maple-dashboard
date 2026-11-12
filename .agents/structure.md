# maple-dashboard — 구조 참고

> 파일 · 표를 바꾸면 여기도 고친다. 지금 상태는 [handoff.md](handoff.md). 2026-11-12 파일 정리 뒤 새로 씀(옛 부주 정산 · 관리자 구조 설명은 history "개편 전 앱 설명", 정리 전 원본 `C:\dev\_backup\maple-docs-2026-11-12b\`).
> 규칙: 화면 `app/<경로>/page.tsx` 는 얇게(제목 + 부품 하나), 부품 `components/<기능>/`, 계산 · 데이터 · 테스트 `lib/<기능>/`.

## 디렉터리 구조

```
maple-dashboard/
  app/
    layout.tsx                # 루트: Pretendard + 메이플스토리 서체(숫자 전용 font-num), ThemeProvider, SideNav + SiteHeader, Clarity
    page.tsx                  # 홈: "이번 주" + 썬데이 카드(lib/sunday/view.ts) + 도구 카드(lib/nav.ts). 요청마다 렌더링
    [tool]/page.tsx           # 아직 없는 도구의 "준비 중" 페이지(generateStaticParams, 그 밖은 404)
    globals.css               # 색 토큰. :root(라이트)가 .dark 보다 먼저 와야 함
    icon.png · apple-icon.png · opengraph-image.jpg (+ .alt.txt)
    boss-split/page.tsx       # 분배금 계산기 → components/boss-split/boss-split-calculator.tsx
    ev/page.tsx               # 기댓값 계산기 → components/ev/ev-calculator.tsx (5탭)
    mvp/page.tsx              # MVP 계산기 → components/mvp/mvp-calculator.tsx
    pinball/page.tsx          # 핀볼 추첨 → components/pinball/pinball-game.tsx
    spec/page.tsx             # 숨은 스펙업(서버): ?name= → lib/spec/load.ts → components/spec/spec-check.tsx
    sunday/page.tsx           # 썬데이(서버, 요청마다 렌더링): lib/sunday/view.ts → components/sunday/sunday-view.tsx
    enhance/page.tsx          # 강화 기록 → components/enhance/enhance-app.tsx (브라우저에서만 동작, 상세 enhance.md)
    enhance/actions.ts        # 공용 아이템 사전 서버 액션: lookupItems · reportItems (아이템 사실만, 횟수 제한)
    privacy/page.tsx          # 개인정보처리방침(EFFECTIVE_DATE)
    api/cron/sunday/route.ts  # 썬데이 자동 갱신 Cron(CRON_SECRET) — "API route 없음" 규칙의 예외
  components/
    side-nav.tsx · site-header.tsx · brand.tsx · page-header.tsx · clarity.tsx · theme-provider.tsx · theme-toggle.tsx
    boss-split/boss-split-calculator.tsx   # 분배금 화면 전체(클라이언트)
    ev/                       # ev-calculator + 탭 5개(starforce · potential · flame · soul · ability) + custom-goal(잠재 직접 모드) + ui(칩 · 세그먼트 · 숫자 칸 · eok)
    mvp/mvp-calculator.tsx · pinball/pinball-game.tsx · spec/spec-check.tsx · sunday/sunday-view.tsx
    enhance/                  # enhance-app(키 관문) · key-gate · starforce-board · starforce-views(보기 4개 + 아이템 창) · potential-board
                              # board-bits(두 보드 공용: 기간 · 받기 · 탭 · 월드 묶음 버튼) · parts(카드 · 띠 · 배지)
                              # use-item-dict(공용 아이템 사전) · use-worlds(잠재능력 기록의 월드 · 캐릭터 통찰력)
    ui/                       # shadcn/ui(base-nova): badge · button · dialog · input · tooltip
  lib/
    nav.ts                    # 메뉴 묶음 · 도구 목록(아이콘 · 홈 카드 문구 · 준비 중 여부) — 메뉴와 홈이 같이 씀
    format.ts (+ test)        # formatNumber · koreanUnits(만 · 억 · 조 · 경) · formatKoreanMeso 등
    meso-input.ts             # 쉼표 넣기 + 커서 위치 유지 입력 처리
    use-stored.ts · use-now.ts   # 브라우저 저장(localStorage) / 30초 시계
    supabase.ts · supabase-admin.ts   # anon 클라이언트 / 서버 전용 키(server-only)
    rate-limit.ts             # 횟수 제한(DB counter_hit, server-only) — 아이템 사전이 씀
    empty-module.ts           # box2d-wasm 의 fs · path 를 브라우저에서 비우는 별칭(next.config.ts)
    utils.ts                  # cn()
    boss-split/               # boss-split-math(chuchu.gg 산식) + test, split-image(결과 이미지)
    mvp/                      # mvp(등급 · 주차 · 충전 계획 · 되팔기 효율) + test
    ev/                       # 기댓값 계산(starforce · potential · flame · soul · ability · luck) + test, data/(공식 확률표 JSON), defaults.ts
    enhance/                  # 강화 기록. 스타포스: parse · judge(손익) · stats(집계) · items(레벨 / 노작)
                              # 잠재능력: potential(기록 · 옵션 · 큐브 메소) · pot-stats(물건별 집계), kst, worlds(월드 3묶음)
                              # 브라우저 전용: client(넥슨 직접 호출) · idb · sync · keys
                              # 사전: dict(검사 · 올릴 것 고르기, 브라우저 · 서버 공용) · dict-server(server-only) + 각 test
    nexon/api.ts (+ test)     # 넥슨 Open API 서버 전용 호출(NEXON_API_KEY, 220ms 간격) — 숨은 스펙업
    spec/                     # check(규칙, 순수 함수) + test, load(API → 3시간 캐시), symbol, data/classes.json
    sunday/                   # bundles · history · predict + test · view, data/history.json · benefits.json
                              # 자동 갱신: notice · notice-parse · ocr · ocr-lines · match(+ fixtures) · ignored · auto-update
                              # 저장: stored + test · store(sunday_weeks 쓰기) · live(화면용 읽기)
    third-party/roulette/     # 핀볼 엔진 = lazygyu/roulette(MIT, LICENSE 사본) 정리본 + 우리 코스 stage.ts
  fonts/Maplestory/ · fonts/Pretendard/   # 넥슨 공식 OTF / 공식 가변 서브셋 92조각, 각 LICENSE
  public/brand-mark.png       # app/icon.png 의 96px 사본(로고)
  supabase/migrations/        # 006 썬데이 · 007 회원(nexon_accounts) + 횟수 세기 · 009 아이템 사전
  vercel.json                 # 리전 icn1 + 썬데이 Cron 일정
  next.config.ts · components.json · eslint.config.mjs · tsconfig.json
```

git 밖(개발 PC 에만): `.env.local` · `.env.local.example`(변수 이름), `AGENTS.md`, `.claude/`, `vendor/`, 그리고 `CLAUDE.md` · `.agents/`(2026-11-12 부터).

미리보기 서버 = 워크스페이스 공유 `C:\dev\.claude\launch.json` 의 `maple-dashboard-dev`(3001). 확인용은 `next build` 뒤 `next start -p 3011`(사용자가 씀) · `-p 3012`(Claude 확인용, 저장소가 분리됨).

## DB (Supabase Postgres, 프로젝트를 냠냠캔버스와 같이 씀 → 표 이름에 `public.`)

옛 부주 정산 표 5개는 2026-11-11 삭제(백업 `C:\dev\_backup\maple-db-2026-11-08\`).

| 표 | SQL | 내용 | 읽기 / 쓰기 |
| --- | --- | --- | --- |
| `sunday_weeks` | 006 | 썬데이 한 주 = 한 행(`sunday` 가 키), `status` auto · confirmed 만 공개 | 누구나(공개 행) / 서버 전용 키 |
| `sunday_cron_runs` | 006 | Cron 실행 기록(언제 · 어느 주 · 결과 · 걸린 시간) | 서버 전용 키만 |
| `nexon_accounts` | 007 | 회원의 넥슨 계정 연결(키 암호문) — 로그인 코드는 `members` 브랜치, 지금은 안 씀 | 본인(메이플 회원) / 서버 전용 키 |
| `rate_counters` + `counter_hit()` | 007 | 횟수 세기(창이 지나면 새로) — 아이템 사전 올리기가 씀 | 서버 전용 키만 |
| `item_dict` | 009 | 공용 아이템 사전: 이름 → 레벨 · 아이콘 코드 · 부위 | 누구나 / 서버 전용 키 |

열 설명은 각 SQL 파일 주석. 스키마 변경은 `supabase/migrations/` 에 여러 번 실행해도 안전한 SQL 로 남긴다.

## 기술 스택

- Next.js 16.4.3 (App Router, Turbopack), React 19.2.8, TypeScript. 이 Next 버전은 학습 데이터보다 최신 → `node_modules/next/dist/docs/` 를 직접 참고.
- Tailwind CSS v4 (`@custom-variant dark (&:where(.dark, .dark *))`), `next-themes`.
- 글꼴 = Pretendard + 큰 숫자만 메이플스토리 서체(`font-num`).
- **shadcn/ui** (style `base-nova`, Base UI 기반) — 새 컴포넌트는 `npx shadcn@latest add <name>`. `shadcn init` 이 `app/globals.css` · `app/layout.tsx` 를 덮어쓴 적 있음 → CLI 뒤 두 파일 diff 확인.
- Supabase — **서버에서만**(Server Components / Server Actions), 데이터 변경은 Server Actions. 강화 기록은 예외로 브라우저가 넥슨을 직접 호출(우리 서버를 안 거침).
- 캐싱: `unstable_cache` + `updateTag` / `revalidateTag`. 시간에 따라 바뀌는 페이지(썬데이 · 홈)는 요청마다 렌더링 + DB 행만 캐시.
- 테스트: `npm test`(node --test, `lib/**/*.test.ts`). JSON import 는 `with { type: "json" }`.
- 환경변수(값은 출력 · 커밋 · 문서 기록 금지): `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `NEXON_API_KEY` · `CRON_SECRET` · `CLOVA_OCR_URL` · `CLOVA_OCR_SECRET` · `NEXT_PUBLIC_CLARITY_ID`. `ADMIN_PASSWORD` 는 코드에서 안 씀(Vercel 에서 삭제 대기).
