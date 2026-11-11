# maple-dashboard — 프로젝트 핸드오프 문서

메이플스토리 도구 모음(내 수익 · 계산기 · 정보 도우미) — 전면 개편 중인 독립 Next.js 프로젝트. (포트폴리오 `C:\dev\portfolio` 와는 별개.)

- GitHub: https://github.com/JEONJOOHYUN/maple-dashboard (public)
- Vercel: 프로젝트 `maple-dashboard`, 배포 URL https://maple-dashboard-eta.vercel.app
- Supabase: 프로젝트 id `dwxntehggzojbzbeydxm`, region `ap-northeast-2` (Seoul), Free/NANO tier
  (약 1주 미사용 시 자동 일시정지됨 — 오랜만에 접속하면 첫 요청이 느릴 수 있음)

> 지금 상태·결정·함정만 둔다. 디렉터리 구조·DB 스키마는 [structure.md](structure.md), 작업 규칙은 [../CLAUDE.md](../CLAUDE.md).
> 지난 기록 원문은 [history.md](history.md)(1단계 과정, 2단계 세션 기록 · 도구 상세, 디자인 과정, 개편 전 앱, 2026-11-10 정리분). 정리 전 원본 `C:\dev\_backup\handoff-2026-11-10\`.

## 현재 상태 (2026-11-11)

- 운영(`main`): 개편 전 모양 그대로. 마지막 푸시 `c60f794`(2026-11-01 Next 16.4.3 보안 업데이트).
- 개편(`redesign`): 0 · 1단계, 2단계 공개 도구 다섯 개(기댓값 · MVP · 핀볼 · 숨은 스펙업 · 썬데이), 썬데이 자동 갱신 저장 단계까지. 원격과 같음(`2c09756` 까지 푸시, 2026-11-11). 푸시는 사용자가 "푸시해"라고 할 때만.
- 로그인 작업 = 로컬 브랜치 `members`(`redesign` 위, 푸시 안 함). 아래 "다음 할 일" 2번.
- Vercel 환경변수 `NEXON_API_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `CLOVA_OCR_URL` · `CLOVA_OCR_SECRET` 등록됨(Production + Preview, 이름만 확인).
- `vendor/` 는 git 밖(`.gitignore` · tsconfig `exclude` · eslint `globalIgnores`) — 핀볼 원본 참고용, 광고 코드 · 인물 그림을 공개 저장소에 안 올림.

## 다음 할 일

0. **지금 순서(2026-11-11 사용자 확정) — 새 세션은 여기부터**: 로그인 방식은 넥슨 답을 본 뒤 정하고, 그 전에 메인을 올린다.
   1. ~~로그인 코드 보관~~ — 완료(2026-11-11): 로그인 작업 = 로컬 브랜치 `members`(`redesign` 위 커밋 1개). 이어 갈 때 `git switch members` → `git rebase redesign`.
   2. **메인 올릴 준비(`redesign`) — 완료 · 커밋됨(2026-11-11, 푸시 안 함)**: 옛 관리자 · 정산 코드 삭제(목록 structure.md 맨 위), `008_drop_legacy_tables.sql`(파일만 — **새 코드가 운영에 배포된 뒤 실행**, 그 전에 실행하면 운영 옛 화면이 깨짐), 헤더 로그인 버튼 숨김, 홈 "이번 주 내 메이플" 카드 뺌 · 내 수익 소개 = 준비 중, `/privacy`(시안 https://claude.ai/artifact/WWpKwXWYNT5wsiSBFih1Jn = C 메인 + B 하단, 사용자 확정) + 모든 페이지 아래 방침 링크(`app/layout.tsx` footer).
      - 방침에는 지금 있는 것만 적음(Clarity · 닉네임 조회 · Vercel 접속 기록 · 브라우저 저장). **`/enhance`(키) · 캡처 · 회원 기능을 열 때 방침부터 고치기.** 시행일 = `app/privacy/page.tsx` `EFFECTIVE_DATE`(**`main` 합치는 날로 바꾸기**), 연락처 = maplestorydashboard@gmail.com(사용자).
      - 확인: lint · 테스트 101 · build · Codex(기본 모델, 지적 1건 = 닉네임 캐시 "3시간 뒤 삭제"가 실제와 다름 → 문구 고침), 3011 에서 `/privacy` 라이트 · 다크 · 375px · 홈, `/admin` · `/settlement` 404. `/login` 은 "준비 중" 자리 페이지로 남음(링크 없음), `ui/input` 은 `members` 가 써서 남김. 방침 사실 확인 출처는 history.
      - 남은 것: `main` 합치기(사용자 결정, 시행일 바꾸기) → 합친 뒤 사용자: Vercel `ADMIN_PASSWORD` 삭제 · Production 환경 변수 확인 → 008 실행(Supabase MCP `execute_sql` 이 동작함 — 사용자가 말하면 SQL 보여 주고 Claude 가 실행 가능).
   3. **강화 기록 `/enhance`(로그인 없이, 키로 조회)**: chuchu.gg/starforce 방식. 키는 브라우저에만 기억 · 서버에 저장 안 함. 처음엔 스타포스 + 큐브만(공식 제공 가능 API), 잠재능력 재설정은 넥슨 답 뒤. 명세 §3-2 · §4-3 · 시안 `A-enhance`(5가지 보기). 브라우저 직접 호출(CORS) 가능 여부부터 확인, 지난 날짜는 다시 안 받게 브라우저에 저장. 끝나면 메인에 추가.
   4. **보스 도우미**(카링부터, 명세 §4-4) → 메인에 추가.
   5. **넥슨 답 뒤**: 로그인 방식 결정(후보 = 구글 주 + 아이디 보조 / API 키 로그인) → `members` 브랜치 이어서 → 내 수익 · 보스 수익 · 숙제 · 알림(매일 · 원하는 시각).
   - 넥슨 문의 글 = `C:/dev/_work/maple/nexon-inquiry-2026-11-12.txt`(사용자가 2026-11-12 보냄 예정). 비밀번호 찾기: 아이디만으로는 방법 없음 → 구글 연결로 재설정하는 안을 Claude 가 추천, 사용자 결정 전.
1. **썬데이 매주 자동 갱신 — 코드 끝**(`2c09756` 푸시 · Preview READY, 2026-11-11): Cron → 공지 찾기 → CLOVA OCR → 혜택 맞추기(모르면 "확인 필요") → `sunday_weeks` 저장 → 화면. 과정 · 채점 · 결정 원문 history "2026-11-11 정리".
   - **남은 것**: 2026-11-13(금) 공지로 Preview 에서 전체 흐름 확인(사용자 "썬데이 확인해"), 그 공지가 넥슨 목록에 바로 뜨는지도. Cron(`vercel.json`, 주 20번)은 Production 에서만 → `main` 합친 뒤부터 자동, 늦으면 외부 알람(미정).
   - CLOVA = 월 100회 무료(이미지 1장 = 1회), 2026-11 남은 18회. `?dry=1` 도 호출을 씀. 아직 안 읽은 옛 공지 92주는 다음 달 `run-clova.mjs`(`C:/dev/_work/sunday-ocr-test/README.md`).
   - "확인 필요" 주는 회원 기능 전까지 대화로 처리(이미지 · 읽은 글자 보여 주고 승인하면 서버 키로 확정). 안 고친 검토 항목: C 공개 행의 모든 열 노출(승인 안 받음).
   - 함정: Cron 은 HTTP 경로만 불러 "API route 없음" 규칙의 예외.
   **그 전까지(A)**: 금요일 공지 뒤 사용자가 "썬데이 추가해" → 공지 이미지 읽고 `C:/dev/_work/maple-sunday-data/src/new-weeks.json` 에 추가 → `node scripts/build.mjs C:/dev/maple-dashboard/lib/sunday/data 2023-08-27` → `npm test` → 커밋. 안 하면 화면에 "기록 n주 밀림" 경고 · 예측 정확도 떨어짐.
2. **3단계 회원 — 로그인 코드는 `members` 에 보관, 넥슨 답 뒤 이어 감**: 시안 A안 https://claude.ai/artifact/V18FVp2aMS7Ykr5RuYjcaZ , `007` 실행됨(`nexon_accounts` · `rate_counters` · `counter_hit()`). 들어 있는 파일 · 결정(아이디 규칙 · RLS · 키 암호화) · 과정 원문 history "2026-11-11 정리".
   - **사용자 대기**: `members` 배포 전 Vercel `MAPLE_KEY_SECRET`(`.env.local` 과 같은 값) 등록, 시험 계정 `claude_test1` 삭제 여부, 구글 로그인 추가(Auth 설정이 냠냠과 공유).
   - 넥슨 약관 제5조: 스타포스 · 큐브 조회 API 는 다른 사람에게 제공 가능(공지 2023-12-21 notice/2449064) → 강화 기록 근거 있음. 스케줄러 · ouid 는 미확인 → 넥슨 문의 답 대기.
   - **함정: openapi.nexon.com 문서 화면(game/…)은 로그인 상태면 사용자 API 키 전체가 보임 → 열지 말 것**(공지 · 약관 화면은 안전).
3. **파일 정리 — 3단계에서 옛 코드를 지운 직후, `main` 합치기 전에 한 번에**(2026-11-09 사용자 결정, 승인한 항목만): `lib/mvp.ts` · `settlement-math` · `boss-split-math` · `split-image` → `lib/<기능>/`, `settlement-client.tsx` · 분배금 화면 본문 → `components/<기능>/`, `lib/` 바로 아래는 공용만, 핀볼 엔진 `lib/pinball/` → `lib/third-party/roulette/`, `AGENTS.md` 를 `.gitignore` 에, `project-spec.md`(78KB) 끝난 기능 history 로, `structure.md` 새 구조로. 위치 · import 만 바꾸고 로직은 그대로, 별도 커밋. prettier 를 넣고 싶으면 이때 모양만 바꾸는 커밋으로 따로(지금은 안 씀).
- 숨은 스펙업 남은 것: 하루 한도 "가까우면 안내"(3단계 DB 카운터 표), 보약 찾는 방식, 유니온 프리셋, 5차 공용 코어 목록(`check.ts` BOSS_COMMON_CORES, Claude 판단), 조회 더 빠르게(결과 나눠 보여 주기 · 넥슨 서비스 키 — 사용자와 정하기).
- **확인 필요(사용자)**: 썬데이 테마 이름 "옵션 강화"(Claude 추천), 추옵 탭 환산 기본값(올스탯1%=10 · 공1=4)을 잠재 탭 maplescouter 환산에 맞출지, MVP 크레딧 적립 5%(maple-mvp.com 기준), 에디 방어구 주스탯 합에 9레벨당 · 공 정수를 안 세는 부분, 잠재 장갑 · 모자의 주스탯 줄에 낮은 값(9% 등)도 셀지(지금 셈).
- **새 파일은 기능별 폴더 규칙대로**: 화면 `app/<경로>/page.tsx` 는 얇게, 부품 `components/<기능>/`, 계산 · 데이터 · 테스트 `lib/<기능>/`.

## 도구별 요점 (상세 · 수치는 history "2026-11-10 정리", 명세 §4)

- **기댓값** `/ev`(스타포스 · 잠재 · 추옵 · 소울 · 어빌리티 5탭): 계산 `lib/ev/*.ts`, 공식 확률표 `lib/ev/data/potential.json` · `ability.json`(다시 받기 `C:/dev/_work/maple-ev-data/`), 기본값 `lib/ev/defaults.ts`.
  사용자 결정: 서큘레이터 개수 = (1 − P) ÷ P, 천장 = N번 연속 실패 뒤 다음 번 확정, 메소를 항상 먼저, 정해진 재설정 비용은 글자만, 방어구 · 장신구 주스탯 목표 = maplescouter 환산(`ev:statConv`), 잠재 공 · 마 선택 칸 없음(두 줄 확률 같음), 특수 직업 = 일반 / 제논 · 올스탯 / 데벤 · HP(`ev:mainStat`), 장갑 · 모자 = 크뎀/쿨감 줄 − + · 주스탯 줄 − +(`comboChance`).
- **MVP** `/mvp` = C안 효율 순위판(`lib/mvp.ts`, 저장 `mvp:settings2`).
- **핀볼** `/pinball` = `lib/pinball/`(원본 lazygyu/roulette MIT, 코스 "Wheel of fortune", 물리 `box2d-wasm@7.0.0`).
- **숨은 스펙업** `/spec`: 닉네임 → 서버에서 넥슨 API 13회(220ms 간격 큐) → 규칙 검사(`lib/spec/check.ts`, 직업 데이터 `lib/spec/data/classes.json`) → 3시간 캐시(`RULES_VERSION` 올리면 옛 캐시 안 씀). 칭호는 지금 낀 칭호만.
- **썬데이** `/sunday` + 홈 카드: 데이터 `lib/sunday/data/history.json`(2023-08-27 ~, 사용자: 옛날 것 빼기) · `benefits.json`, 예측 `lib/sunday/predict.ts`(샤이닝 · 미라클 주기 → 나머지 묶음 hazard × 최근 빈도, 학습 2025-03-23 ~, 3개는 종류별로 섞어 고름 → 최근 52주 38/52, maplessunday 27주 24 vs 우리 22), 테스트가 이 점수를 고정.
  테마 3개 = 스타포스 / 옵션 강화 / 사냥, "테마마다 나올 확률"(합이 100% 넘음). 묶음 = 늘 같이 나오는 혜택(룬 + 콤보킬 + 룬 재등장, 몬컬 + 모몽 + 엘몹 등, `lib/sunday/bundles.ts`). 페이지 · 홈은 `revalidate = 3600`.
  데이터를 다시 만드는 스크립트 · 출처 · 사실 확인 기록은 `C:/dev/_work/maple-sunday-data/README.md`(git 밖), 예측 시험 코드 `exp/`.
- 비회원 저장 = `lib/use-stored.ts`(localStorage, 실패하면 메모리), 시계 = `lib/use-now.ts`.

## 결정 · 함정

- **화면 문구(사용자)**: 짧은 명사형 + 화살표, "~해요" 없이. 계산 방식 같은 뻔한 설명 · 내부 용어("큰 날" 등) 넣지 않기.
- **넥슨 그림**: 원본 게임 그림은 공개 저장소 · 사이트에 안 씀(brain `wiki/research/nexon-ip-guide.md`), 장비 그림 = Open API 아이콘 주소. 표기 "MapleStory © NEXON Korea · Data based on NEXON Open API · 비공식" = 데스크톱 사이드 메뉴 맨 아래, 모바일 페이지 끝.
- **로고** = 앱 아이콘 사본 `public/brand-mark.png`(96px, `components/brand.tsx` 정적 import + unoptimized). **`app/icon.png` 를 바꾸면 사본도 다시 만들기**: `node -e "require(\"sharp\")(\"app/icon.png\").resize(96,96).png({compressionLevel:9}).toFile(\"public/brand-mark.png\")"`.
- box2d-wasm 의 Emscripten 코드가 `require('fs')` 를 품어 `next.config.ts` `turbopack.resolveAlias`(fs · path → `lib/empty-module.ts`, browser 만). 이 설정을 바꾼 뒤 개발 서버가 다시 읽지 않아 **페이지가 무한 새로고침** → 개발 서버를 껐다 켜기.
- 한 폴더에 `next dev` 는 하나만 → 확인용은 `next build` 후 `next start -p 3011`. 백그라운드로 켠 3011 은 작업 중지로 안 꺼짐 → 포트를 잡은 PID 를 찾아 끄기. **빌드를 다시 하면 3011 도 껐다 켜기.**
- JSON import 는 `with { type: "json" }`(node --test 에 필요). 크롬 창을 375로 줄여도 `innerWidth` 가 안 바뀜 → 같은 출처 페이지에 375px iframe 을 넣어 확인.
- **`npx` 로 프로젝트에 없는 도구를 부르지 않기**: `npx node` · `npx prettier` 가 새 판을 내려받아 실행함(2026-11-10, prettier 가 파일 모양을 바꿔 되돌림). 테스트는 `npm test`.
- Next 이미지 최적화: 주소가 같으면 브라우저가 예전 그림을 캐시에서 씀 → 바뀌는 그림은 정적 import(내용 해시 주소).

## 전면 개편 계획 → [project-spec.md](project-spec.md)

- 2026-11-07 확인: 스케줄러·확률 API 는 **키 주인 계정 데이터만** → 숙제·강화 기록은 사용자 본인 API 키 필요. 스케줄러에 완료 여부 있음(14일까지), 스타포스 기록엔 메소 비용·아이템 레벨이 없어 비용을 직접 계산해야 함.
- **디자인: A안(메보스형) 확정(2026-11-07), 디자인 끝(2026-11-08, 캔버스 Version 71)** — 캔버스 https://claude.ai/artifact/2ECnKh4QSJB2znjRYUV7kk , 상세 [design.md](design.md).
  메뉴 = 홈 / 내 메이플(내 수익·숙제·보스 수익·강화 기록·알림) / 계산기(분배금·기댓값·MVP) / 정보 · 도우미(썬데이·숨은 스펙업·보스 도우미) / 놀이(핀볼). 캐릭터 검색 없음(숨은 스펙업만 예외), 로그인 = 아이디 또는 API 키, 로그인 상태 4가지, 아이콘 = lucide-react, 달력·요일 표기는 전부 일~토.
  중심 기능 = **내 수익**(화면 문구에 "부주" 안 씀), 보스 도우미 대상 = 카링·흉성·림보·발드릭스·유피테르.
- 개편 전 보안 구멍(명세 §5): `redesign` 에서는 옛 관리자 코드 삭제로 닫힘(2026-11-11). 운영(`main`)은 합칠 때까지 열려 있음.
- **2026-11-08 사용자 결정**: 기존 데이터는 옮기지 않고 새로 시작(백업 `C:\dev\_backup\maple-db-2026-11-08\`, git 밖). 옛 관리자 방식(`/admin`·`ADMIN_PASSWORD`·관리자 쿠키·액션)은 통째로 없앰.

## 개편 단계 (2026-11-08 사용자 지시 — 단계마다 보고하고 멈춤, 사용자가 "다음"이라고 하면 진행)

- **0 · 1 · 2단계** — 완료(`bfcbcc7` · `6e2eb10` · 위 "도구별 요점"). 토큰 `globals.css`, 메뉴 `lib/nav.ts`, 없는 기능 = `app/[tool]/page.tsx` "준비 중", Clarity `components/clarity.tsx`. 1단계 과정 history "개편 1단계".
- **3단계 회원·권한**(명세 §1·§5): 냠냠과 같은 Supabase → 전체 인증 설정 · `nyamnyam` 스키마 안 건드림, 가입 = 서버 `auth.admin.createUser` + `app_metadata.app = "maple"`, service role 서버 전용. 새 테이블 `user_id NOT NULL` + RLS. 옛 public 표 삭제 SQL 은 배포 때 보여 주고 실행. Codex 리뷰 기본 모델.
- **4단계 로그인 뒤 기능**(기능마다 보고하고 멈춤, 2026-11-11 순서): ① 내 수익(캡처 읽기는 브라우저 Tesseract.js) → ② API 키 등록 → ⑥ 강화 기록 → 넥슨 답 뒤 ③ 숙제 · ④ 보스 수익 · ⑤ 홈 "이번 주" · ⑦ 알림 → ⑧ 보스 패턴. 넥슨 API 는 서버에서만, 하루 1,000건 제한이라 캐시, 저장 데이터는 30일 안에 갱신. 위 0번 순서가 우선.

## 기술 스택

- Next.js 16.4.3 (App Router, Turbopack), React 19.2.8, TypeScript. 이 Next 버전은 학습 데이터보다 최신 → `node_modules/next/dist/docs/` 를 직접 참고.
- Tailwind CSS v4 (`@custom-variant dark (&:where(.dark, .dark *))`), `next-themes` (다크모드).
- 글꼴 = Pretendard(`fonts/Pretendard/`) + 큰 숫자만 메이플스토리 서체(`fonts/Maplestory/`, `font-num`).
- **shadcn/ui** (style `base-nova`, Base UI 기반) — `components/ui/*`, 새 컴포넌트는 `npx shadcn@latest add <name>`.
  주의: `shadcn init` 이 `app/globals.css` · `app/layout.tsx` 를 덮어쓴 적 있음(Geist 폰트) → CLI 뒤 두 파일 diff 확인. `globals.css` 에서 **`:root`(라이트)가 반드시 `.dark` 보다 먼저**(명시도가 같아 순서가 뒤집히면 다크모드가 라이트 색으로 남음).
- Supabase(Postgres) — `@supabase/supabase-js`, **서버에서만**(Server Components / Server Actions), `SUPABASE_URL` / `SUPABASE_ANON_KEY`(NEXT_PUBLIC_ 아님). 데이터 변경은 전부 Server Actions, 클라이언트 fetch/API route 없음.
- 캐싱: `unstable_cache` + `updateTag`("Previous Model" 유지, 의도적 선택). 시간에 따라 바뀌는 페이지는 `export const revalidate = 3600`(썬데이 · 홈).
- Vercel 함수 리전 `icn1` 고정(`vercel.json`).
- 환경변수(`.env.local`, gitignored, 값은 출력 · 커밋 · 문서 기록 금지): `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `ADMIN_PASSWORD`(코드에서 안 씀, 운영 배포 뒤 사용자가 삭제) · `NEXON_API_KEY`. 키 이름은 `.env.local.example`.

## 개편 전 앱

- 옛 부주 정산 · 관리자 코드는 2026-11-11 삭제(`redesign`). 설명 원문 history "개편 전 앱 설명", 옛 표 삭제 = `008`(운영 배포 뒤).
- 보스 분배금 계산 `lib/boss-split-math.ts`(chuchu.gg 산식)는 1단계에서 새 화면으로 옮겨 계속 씀.

## 세션 기록 (자세한 원문은 history)

- 2026-11-11(2): 로그인 코드를 `members` 로 보관, handoff 26KB → 정리(원문 history "2026-11-11 정리", 원본 `C:dev_backuphandoff-2026-11-11`), 메인 올릴 준비(옛 코드 삭제 · 008 · 방침 · 홈 정리).
- 2026-11-11: 썬데이 저장 단계 푸시 · Preview 배포, 3단계 시작(계획 · 넥슨 약관 확인 · 로그인 시안 3안 → A안 · 007 SQL).
