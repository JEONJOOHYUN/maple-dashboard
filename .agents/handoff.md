# maple-dashboard — 프로젝트 핸드오프 문서

메이플스토리 부주(mule) 사냥 수익 정산 및 누적 대시보드. 여러 메이플 관련 도구를
탭으로 얹을 수 있게 설계된 독립 Next.js 프로젝트. (기존 포트폴리오 프로젝트는
`C:\dev\portfolio`로 분리되어 있고, 이 프로젝트와는 완전히 별개.)

- GitHub: https://github.com/JEONJOOHYUN/maple-dashboard (public)
- Vercel: 프로젝트 `maple-dashboard`, 배포 URL https://maple-dashboard-eta.vercel.app
- Supabase: 프로젝트 id `dwxntehggzojbzbeydxm`, region `ap-northeast-2` (Seoul), Free/NANO tier
  (약 1주 미사용 시 자동 일시정지됨 — 오랜만에 접속하면 첫 요청이 느릴 수 있음)

> 지금 상태·결정·함정만 둔다. 디렉터리 구조·DB 스키마는 [structure.md](structure.md), 작업 규칙은 [../CLAUDE.md](../CLAUDE.md).

## 현재 상태 (2026-11-01)

- 마지막 커밋 `cb497ac`(2026-09-18, 일일 기록 입력 이력 `log_entries`) 이후 기능 변경 없음. 진행 중인 일 없음.
- 2026-11-01 Next 16.3.1 → 16.4.3 + `npm audit fix`(Next.js 10월 보안 업데이트(2026-10-14: Server Actions DoS·이미지 SVG RCE·use cache RCE, 16.4.1 에서 수정) — 이 앱은 Server Actions 를 써서 해당). 남은 audit 경고는 보통·낮음뿐(대부분 shadcn CLI 경유).
- 2026-10-29 문서 위치 통일: 이 파일은 `.claude/docs/handoff.md` 에서 옮겨 옴.

## 기술 스택

- Next.js 16.4.3 (App Router, Turbopack), React 19.2.8, TypeScript
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

- 비밀번호는 `ADMIN_PASSWORD` 환경변수로만 관리 (값은 코드·저장소·문서에 적지 않는다).
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
