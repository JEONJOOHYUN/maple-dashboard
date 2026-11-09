# maple-dashboard — 프로젝트 핸드오프 문서

메이플스토리 부주(mule) 사냥 수익 정산 및 누적 대시보드. 여러 메이플 관련 도구를
탭으로 얹을 수 있게 설계된 독립 Next.js 프로젝트. (기존 포트폴리오 프로젝트는
`C:\dev\portfolio`로 분리되어 있고, 이 프로젝트와는 완전히 별개.)

- GitHub: https://github.com/JEONJOOHYUN/maple-dashboard (public)
- Vercel: 프로젝트 `maple-dashboard`, 배포 URL https://maple-dashboard-eta.vercel.app
- Supabase: 프로젝트 id `dwxntehggzojbzbeydxm`, region `ap-northeast-2` (Seoul), Free/NANO tier
  (약 1주 미사용 시 자동 일시정지됨 — 오랜만에 접속하면 첫 요청이 느릴 수 있음)

> 지금 상태·결정·함정만 둔다. 디렉터리 구조·DB 스키마는 [structure.md](structure.md), 작업 규칙은 [../CLAUDE.md](../CLAUDE.md).
> 지난 기록 원문(1단계 과정, 2단계 1~14차 세션 기록, 디자인 단계 과정, 개편 전 앱 설명)은 [history.md](history.md). 2026-11-09 정리 전 원본 `C:\dev\_backup\maple-handoff-2026-11-09\`.

## 현재 상태 (2026-11-09, 2단계 진행 중)

- 운영(`main`): 마지막 푸시 `c60f794`(2026-11-01 Next 16.4.3 보안 업데이트), 마지막 기능 변경 `cb497ac`(2026-09-18). 운영 사이트는 개편 전 모양 그대로.
- 개편(`redesign` 브랜치, 푸시 안 함): 0단계 `bfcbcc7` · 1단계 `6e2eb10` 커밋. **2단계 공개 도구 3개(기댓값 · MVP · 핀볼) 완성, `0d85727` 커밋(2026-11-09)**. 썬데이 · 숨은 스펙업은 아직(넥슨 키 `NEXON_API_KEY` 는 2026-11-09 `.env.local` 에 들어옴).
- `vendor/` 는 `.gitignore`·tsconfig `exclude`·eslint `globalIgnores` 로 뺌(2026-11-08) — 원본은 이 PC 에만 두는 참고용, 광고 코드·인물 그림을 공개 저장소에 올리지 않으려고.
- 2026-11-01 Next 16.3.1 → 16.4.3 + `npm audit fix`(Next.js 10월 보안 업데이트 — Server Actions DoS 등, 이 앱은 Server Actions 를 써서 해당). 남은 audit 경고는 보통·낮음뿐(대부분 shadcn CLI 경유).

## 다음 할 일 (2026-11-09 세션 끝)

1. ~~커밋~~ 완료 `0d85727`, **`origin/redesign` 푸시(2026-11-09, 사용자 요청)** — `main` 합치기(= 운영 배포)는 사용자 결정 대기. Vercel 미리보기 배포 여부는 확인 못 함(`gh` 로그인 안 됨). `AGENTS.md`(next dev 자동 생성)는 커밋 안 함.
2. ~~설명 문구 전부 줄이기~~ 완료(2026-11-09, 커밋 · `origin/redesign` 푸시): 기댓값 5탭 · MVP · 핀볼 · 분배금 · 홈 · 준비 중 · 하단 표기에서 "~요" 문장을 명사형으로(`lib/supabase.ts` 개발자 오류 문구만 그대로). 스타포스 추천은 한 줄에 하나, 스타포스 하단 출처 안내는 통째로 삭제(사용자, 출처는 명세 §4-8 · 넥슨 표기는 사이트 하단에 있음). 전역 `body { word-break: keep-all; overflow-wrap: anywhere }`(한글이 단어 중간에서 끊기던 것). MVP 루트 카드 문구 정리(큰 숫자 옆 "실제 부담", "최저가보다 +n원" 빨간 글자, 회수 줄 = "회수 n원 (n%) · 경매장 판매 n회", 단계 = "충전: … (현금 n원)" · "아이템 × n → 경매장 → n원" · "메소마켓: n포인트 → n억 → n원", 크레딧은 보유분이 있을 때만 "(보유 + 적립)", 크레딧 줄 = "크레딧 n → n원" + 아래 작은 줄에 산 물건("프라임 큐브 × 7 · 심연의 서큘레이터 × 1"), 남는 캐시 · 선물 크레딧 없음 · 근삿값은 번호 없는 안내 줄로). 카드 모양 자체를 바꾸려면 3안 먼저. **앞으로 화면 문구는 "~해요" 없이 짧은 명사형 + 화살표**(사용자 선호).
   속도 측정(2026-11-09): 페이지가 눌리기까지 개발 서버 4.45초 → 빌드본 0.38초, 어빌리티 조합 바꾸기 빌드본 약 50~65ms, `abilityPlan` 계산 node 기준 조합당 8~36ms → 느림은 개발 서버 탓, 배포하면 해결. 크롬 창이 뒤에 있으면 rAF 가 늦어 측정이 부풀려짐(DOM 변화를 setTimeout 으로 기다려 잴 것).
3. 썬데이 메이플(명세 §4-10) · 숨은 스펙업(§4-11) — 넥슨 키 있음.
4. 3단계 회원·권한(아래 "개편 단계").

## 전면 개편 계획 → [project-spec.md](project-spec.md)

- 순서: 디자인 3안(아티팩트) → 사용자가 고른 안으로 화면 → 회원·권한 → 기능 추가. 코드·DB 는 안을 고른 뒤에.
- 2026-11-07 브라우저로 mefit 스케줄러·cngtech 보스 도우미·Open API 스케줄러/확률 조회 확인, 결과는 명세 §2~4.
  핵심: 스케줄러·확률 API 는 **키 주인 계정 데이터만** → 숙제·강화 기록은 사용자 본인 API 키 필요. 스케줄러에 완료 여부 있음(14일까지),
  스타포스 기록엔 메소 비용·아이템 레벨이 없어 비용을 직접 계산해야 함.
- **디자인: A안(메보스형) 확정(2026-11-07)** — 이후 A안만 고친다. 캔버스 https://claude.ai/artifact/2ECnKh4QSJB2znjRYUV7kk
  상세(화면 목록·props·결정·참고 사이트·함정)와 명세와 다른 곳 11개(2026-11-08 답함)는 [design.md](design.md).
  요약: 메뉴 = 홈 / 내 메이플(내 수익·숙제·보스 수익·강화 기록·알림) / 계산기(분배금·기댓값·MVP) / 정보 · 도우미(썬데이·숨은 스펙업·보스 도우미) / 놀이(핀볼) — 2026-11-08 묶음,
  캐릭터 검색 없음(숨은 스펙업만 예외), 로그인 = 아이디 또는 API 키, 로그인 상태 4가지(비회원 / 비회원 + 키 / 아이디만 / 키 있음),
  숙제 현황 = 캐릭터 수 요약 + 캐릭터 목록(최대 36) → 선택 캐릭터의 보스 표(파티원·가격)·일일·주간, 보스 수익·가격 설정,
  강화 기록 5가지 보기, 아이콘 = lucide-react(캐릭터·아이템 그림만 Open API 이미지), 달력·요일 표기는 전부 일~토(2026-11-08 바꿈, 예외 없음 — design.md).
- **디자인 끝(2026-11-08 사용자)** — design.md 대기 목록 11개 답을 명세에 반영함(0단계). 시안 수정 끝 = 캔버스 Version 71.
  2026-11-08 시안 추가·변경 요지: 중심 기능 = **내 수익**(부주 정산은 캔버스 "보관", 화면 문구에 "부주" 안 씀), 새 공개 도구 기댓값 · MVP · 핀볼 · 썬데이 · 숨은 스펙업, 보스 도우미 대상 = 카링·흉성·림보·발드릭스·유피테르. 과정 원문은 history "디자인 단계 과정 기록", 상세 design.md.
- **캔버스 고치는 방법(다음 세션용)**: Artifact `read`(url + `paths`)로 `project/*.dc.html` 을 scratchpad 에 받아 고치고, 같은 `url` + `root` 로 게시(보드 위치·크기를 바꾸면 `project/canvas.json` 도 다시 읽고 같이).
  고친 뒤 검사: `node C:/dev/_work/maple-canvas/scripts/check-dc.mjs <받은 project 폴더>`(모든 {{ }} 가 채워지는지 · 화면 블록 하나만 켜지는지), `tags.mjs <파일들>`(태그 짝). `flame.mjs` = 추옵 공식 확률 계산 예.
  눈으로 확인: 크롬으로 캔버스를 열고 보드 클릭 → 확대 메뉴(▾) "Zoom to selection" → 보드 PLAY → "Play full screen" → Fill.
- 핀볼 원본: 사용자가 github.com/lazygyu/roulette ZIP 을 `vendor/roulette/` 에 풀어 둠(받은 그대로). 라이선스 검토는 명세 §4-7, brain `wiki/research/marble-roulette-license.md`.
- 개편 전 보안 구멍(관리자 확인 없는 액션, 쿠키에 비밀번호 원문)은 명세 §5, 아직 열림 → 3단계에서 옛 관리자 방식을 통째로 없애며 닫는다.
- **2026-11-08 사용자 결정**: 기존 데이터는 옮기지 않고 새로 시작(백업 `C:\dev\_backup\maple-db-2026-11-08\`, git 밖). 옛 관리자 방식(`/admin`·`ADMIN_PASSWORD`·관리자 쿠키·액션)은 통째로 없앰, 운영용 관리자 기능은 지금 안 만듦(명세 §1·§5).

## 개편 단계 (2026-11-08 사용자 지시 — 단계마다 보고하고 멈춤, 사용자가 "다음"이라고 하면 진행)

- **0단계 문서 정리** — 완료(2026-11-08, `bfcbcc7`): 명세·design.md 에 11개 답 반영, 메이플스토리 서체 라이선스 확인(명세 §2 "글꼴").
- **1단계 화면만 A안 + 글꼴 + 분배금 계산기 개편** — 완료, `redesign` 브랜치 커밋 `6e2eb10`(2026-11-08). 토큰 `globals.css`, 메뉴 정의 `lib/nav.ts`, 없는 기능은 `app/[tool]/page.tsx` "준비 중", 글꼴 = Pretendard + 큰 숫자만 메이플 서체(`font-num`), Clarity `components/clarity.tsx`. 상세·과정·함정(구글 한글 글꼴 `preload: false` 등) 원문은 [history.md](history.md) "개편 1단계".
- **2단계 공개 도구(로그인 없이)** — 기댓값 · MVP · 핀볼 완료(`0d85727`), 썬데이 · 숨은 스펙업 남음. 차수별 기록 원문은 [history.md](history.md) "개편 2단계 세션 기록".
  - **기댓값 계산기** `/ev`(스타포스 · 잠재 · 추옵 · 소울 · 어빌리티 5탭). 계산 `lib/ev/*.ts`, 테스트 `npm test`(= `node --test`, 44개). 데이터 `lib/ev/data/potential.json`(넥슨 공식 큐브 옵션표, GetSearchProbList) · `ability.json`(공식 어빌리티 옵션표), 기본값 `lib/ev/defaults.ts`(날짜와 함께). 출처·검증은 명세 §4-7 · §4-8 · §4-9. 확률표 다시 받는 스크립트 `C:/dev/_work/maple-ev-data/`(git 밖, README 에 순서).
  - **MVP 계산기** `/mvp` = **C안(효율 순위판) 확정**(시안 https://claude.ai/artifact/LPEC3cM7S9A1Ae4fAKjALf). 계산 `lib/mvp.ts`(`sellRoute` · `creditPlan` 배낭 DP, 600만 원 넘으면 근삿값 `route.approx`), 저장 키 `mvp:settings2`.
  - **핀볼 추첨** `/pinball` = `vendor/roulette` 엔진을 `lib/pinball/` 로 옮김(광고 · 커뮤니티 맵 · 녹화 · 인물 그림 등 뺌, 원본 `LICENSE` 사본). 코스 = 원본 맵 "Wheel of fortune" 하나(MIT 출처 표기, 광고판만 뺌, `stage.ts`), 물리 = 새 의존성 `box2d-wasm@7.0.0`(Zlib), 구슬 = 색깔 공.
  - 비회원 저장 = `lib/use-stored.ts`(localStorage, 실패하면 메모리), 시계 = `lib/use-now.ts`.
  - **어빌리티 계산**(`abilityPlan`): 상태 = 잠근 줄 + 수치 목표 달성 여부, 매 재설정 뒤 그대로 / 잠금 / 서큘레이터 중 가장 싼 길을 값 반복으로 고름. 화면 단계 ①시작 ②첫째 줄 ③둘째 · 셋째 줄 ④남은 줄에 하나 더 ⑤수치.
    ③ · ④ 제목 옆 "뜬 옵션" 칩(④는 ③을 고른 뒤에만 보임, ③을 바꾸면 ④ 초기화, 조합 · 등급을 바꾸면 둘 다 해제, 목표 수치 · 가격 · 썬데이처럼 계산이 바뀌면 ④ 해제 — ③ 처리 방식이 바뀌어 ④ 숫자가 틀려짐, Codex 지적) → 위 요약이 그 상황의 남은 비용 + "처음부터 평균 n억 · n억 덜 들어요". 남은 재설정 횟수 = `afterFirstLower[].resets` · `afterTwo[].resets`.
  - **사용자 결정**: 서큘레이터 개수 = (1 − P) ÷ P(ygh · chuchu 는 1 ÷ P — 수학적으로 맞는 쪽이 신뢰가 감), 천장 = N번 연속 실패 뒤 다음 번 확정(`gradeUp` cap = 보장 횟수 + 1), 메소를 항상 먼저(큰 숫자 · 정렬 · 운 칸), 정해진 재설정 비용은 입력 칸 없이 글자만,
    에디 재설정 · 화이트 에디셔널 큐브는 한 줄(`upAlt`), 방어구 · 장신구 주스탯 목표 = maplescouter 환산(`STAT_CONV_DEFAULT`, 저장 `ev:statConv`), 메소마켓 기본 2,100메포, 명성치 가격 = 5,000당 "만" 입력(기본 200).
  - **넥슨 그림(2026-11-09, brain `wiki/research/nexon-ip-guide.md`)**: 원본 게임 그림은 공개 저장소 · 사이트에 안 씀 → 소울 그림 · starforce.gg PNG 는 `C:\dev\_backup\maple-nexon-art-2026-11-09\` 로 옮김. 장비 그림 = Open API 아이콘 주소(`STAR_ITEMS[].icons`, 키 없이 열림). 표기 "MapleStory © NEXON Korea · Data based on NEXON Open API · 비공식" = 데스크톱 사이드 메뉴 맨 아래, 모바일 페이지 끝.
  - 사이트 대조 끝(2026-11-09): starforce.gg · boomback · mesu.live · maplemoru · mapletiptip · chuchu.gg · ygh.kr · begchi 와 확률 · 메소 일치(차이 나는 곳의 이유는 history).
  - **확인 필요(사용자)**: 추옵 탭 환산 기본값(올스탯1%=10 · 공1=4)을 잠재 탭 maplescouter 환산에 맞출지, MVP 크레딧 적립 5%(maple-mvp.com 기준), 에디 방어구 주스탯 합에 9레벨당 · 공 정수를 안 세는 부분이 maplescouter 환산 반영 뒤에도 남았는지.
  - **함정**: box2d-wasm 의 Emscripten 코드가 `require('fs')` 를 품어 `next.config.ts` `turbopack.resolveAlias`(fs · path → `lib/empty-module.ts`, browser 만). 이 설정을 바꾼 뒤 개발 서버(3001)가 다시 읽지 않아 **페이지가 무한 새로고침** → 개발 서버를 껐다 켜야 함.
    한 폴더에 `next dev` 는 하나만(두 번째는 "Another next dev server" 로 꺼짐) → 확인용은 `next build` 후 `next start -p 3011`. 백그라운드 `npx next start` 를 작업 중지로 끄면 node 자식이 남아 3011 을 계속 잡음(2026-11-09) → 명령줄을 확인하고 그 PID 를 끈다.
    JSON import 는 `with { type: "json" }`(node --test 에 필요). 크롬 창 크기를 375로 줄여도 `innerWidth` 가 안 바뀜 → 같은 출처 페이지에 375px iframe 을 넣어 확인.
  - 남은 도구: **썬데이 메이플**(§4-10, 공지 API + 지난 기록 데이터 파일), **숨은 스펙업**(§4-11, 우리 서버 키로 캐릭터 조회 → 키 환경변수 · `lib/nexon/` · 캐시 · 하루 한도 안내, 규칙은 데이터 파일).
- **3단계 회원·권한**(명세 §1·§5): 냠냠과 같은 Supabase 프로젝트 → 전체 인증 설정·`nyamnyam` 스키마 안 건드림, 가입 = 서버 `auth.admin.createUser` + `app_metadata.app = "maple"`, 로그인은 그 계정만, service role 서버 전용.
  아이디 로그인(가상 이메일)·API 키 로그인(ouid). 새 테이블 `user_id NOT NULL` + RLS `auth.uid() = user_id`. 옛 public 테이블·트리거·함수 삭제는 새 사이트 배포 때(SQL 은 실행 전에 보여 줌).
  옛 관리자 방식 삭제. 대시보드 설정·키 입력은 사용자가(할 일 목록으로 줌). 개인정보처리방침 페이지(Clarity 수집 내용 포함, 캡처 이미지는 서버로 안 보냄·비회원 키는 브라우저에만도 적기). Codex 리뷰 기본 모델.
- **4단계 로그인 뒤 기능**(기능마다 보고하고 멈춤): ① **내 수익**(로그인만, API 키 없이도 — 캡처 읽기는 브라우저 Tesseract.js) → ② API 키 등록·암호화 저장(여러 개) →
  ③ 숙제 → ④ 보스 수익(비회원 이번 주 조회 = 브라우저 직접 호출, CORS 확인 포함) → ⑤ 홈 "이번 주" → ⑥ 강화 기록 → ⑦ 알림 → ⑧ 보스 패턴 도우미.
  (내 수익을 맨 앞에 둔 건 Claude 판단 — 순서는 사용자가 바꿀 수 있음.)
  넥슨 API 는 서버에서만, 하루 1,000건 제한이라 캐시, "Data based on NEXON Open API" 표기, 저장한 데이터는 30일 안에 갱신.

## 기술 스택

- Next.js 16.4.3 (App Router, Turbopack), React 19.2.8, TypeScript
- Tailwind CSS v4 (`@custom-variant dark (&:where(.dark, .dark *))`), `next-themes` (다크모드)
- 글꼴 = Pretendard(`fonts/Pretendard/`) + 큰 숫자만 메이플스토리 서체(`fonts/Maplestory/`, `font-num`) — 1단계에서 Paperlogy 를 바꿈.
- **shadcn/ui** (style `base-nova`, Base UI 기반) — `components.json`, `components/ui/*`에 소스가
  복사되는 방식. 클래스 병합은 `cn` 패키지(`lib/utils.ts`가 re-export). 새 컴포넌트는
  `npx shadcn@latest add <name>`으로 추가.
  주의 1: `shadcn init`이 `app/globals.css`와 `app/layout.tsx`를 덮어쓰면서 Geist 폰트를
  넣어버렸던 적이 있다. shadcn CLI를 다시 돌릴 때는 두 파일의 diff를 꼭 확인하세요.
  주의 2 (다크모드 버그): `globals.css`에서 **`:root`(라이트)가 반드시 `.dark`보다 먼저**
  와야 합니다. 두 셀렉터는 명시도가 같아서 순서가 뒤집히면 `.dark`가 `:root`에 덮여
  다크모드에서 배경/글자색이 라이트 값 그대로 남습니다 (shadcn init이 실제로 이 순서를
  뒤집어 놓은 적 있음).
- Supabase(Postgres) — `@supabase/supabase-js`, **서버 사이드에서만** 사용 (Server Components / Server Actions).
  `SUPABASE_URL` / `SUPABASE_ANON_KEY` (NEXT_PUBLIC_ 접두어 아님 — 클라이언트에 노출 안 됨)
- 데이터 mutation은 전부 Server Actions(`"use server"`)로만 처리. 클라이언트 fetch/API route 없음.
- 캐싱: `unstable_cache`로 읽기 캐시 + `updateTag`로 Server Action 안에서 즉시 무효화
  (Cache Components 신모델이 아니라 "Previous Model" 유지 — 영향 범위를 좁게 가져가기 위한 의도적 선택)
- Vercel 함수 리전 `icn1` 고정(`vercel.json`) — 미국 리전에서 서울 Supabase 를 부르면 느렸음(해결 과정은 history).
- 환경변수(`.env.local`, gitignored, 값은 출력 · 커밋 · 문서 기록 금지): `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `ADMIN_PASSWORD`(3단계 운영 배포 뒤 삭제) · `NEXON_API_KEY`. 키 이름은 `.env.local.example`.
- 이 Next 버전은 학습 데이터보다 최신이라 `node_modules/next/dist/docs/`를 직접 참고해야 함 (AGENTS.md 참고)

## 개편 전 앱(옛 코드, 3단계에서 삭제 예정)

- 부주 정산 `/settlement`(메뉴에서만 빠짐, 주소로 들어가면 옛 모양) · 관리자 `/admin` · 정산 계산 `lib/settlement-math.ts` · 캐시 `lib/queries.ts`. 설명 원문은 [history.md](history.md) "개편 전 앱 설명".
- 보스 분배금 계산 `lib/boss-split-math.ts`(chuchu.gg 산식)는 1단계에서 새 화면으로 옮겨 계속 씀.

## 세션 기록

- 2026-11-08: 0단계 · 1단계 커밋, 2단계 기댓값 · MVP · 핀볼(상세 history).
- 2026-11-09: 2단계 1~14차 수정(상세 history), 어빌리티 4단계 "뜬 옵션" 칩 + `afterTwo[].resets`(테스트 44개, 크롬 3011 빌드본 데스크톱 다크 · 375px iframe 다크 · 라이트, 넘침 없음), 어빌리티 안내 문구를 명사형 화살표로 줄임(사용자: "~해요" 없이 "재설정 · 잠금 · 목표 수치" 식, 예 "서큘레이터로 목표 수치 → 잠금 → 고급 재설정", 제목 "가장 싼 순서", "n억 절약"), Codex 집중 리뷰(gpt-6.1-sol) 지적 1개(계산 조건이 바뀌어도 ④ 선택이 남음) 반영 · 크롬 재확인(지적 그대로라 다시 리뷰 생략), handoff 34KB → 정리(원문 history).
