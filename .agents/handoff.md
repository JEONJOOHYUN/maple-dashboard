# maple-dashboard — 프로젝트 핸드오프 문서

메이플스토리 도구 모음(내 수익 · 계산기 · 정보 도우미) — 전면 개편 중인 독립 Next.js 프로젝트. (포트폴리오 `C:\dev\portfolio` 와는 별개.)

- GitHub: https://github.com/JEONJOOHYUN/maple-dashboard (public)
- Vercel: 프로젝트 `maple-dashboard`, 배포 URL https://maple-dashboard-eta.vercel.app
- Supabase: 프로젝트 id `dwxntehggzojbzbeydxm`, region `ap-northeast-2` (Seoul), Free/NANO tier
  (약 1주 미사용 시 자동 일시정지됨 — 오랜만에 접속하면 첫 요청이 느릴 수 있음)

> 지금 상태·결정·함정만 둔다. 디렉터리 구조·DB 스키마는 [structure.md](structure.md), 작업 규칙은 [../CLAUDE.md](../CLAUDE.md).
> 지난 기록 원문은 [history.md](history.md)(1단계 과정, 2단계 세션 기록 · 도구 상세, 디자인 과정, 개편 전 앱, 2026-11-10 정리분). 정리 전 원본 `C:\dev\_backup\handoff-2026-11-10\`.

## 현재 상태 (2026-11-10)

- 운영(`main`): 개편 전 모양 그대로. 마지막 푸시 `c60f794`(2026-11-01 Next 16.4.3 보안 업데이트).
- 개편(`redesign`): 0단계 `bfcbcc7` · 1단계 `6e2eb10` · 2단계 공개 도구 **다섯 개 모두 완료** — 기댓값 · MVP · 핀볼(`0d85727`), 숨은 스펙업(`cb8cb42`), 썬데이(`27e4bdc`). 로고 = 앱 아이콘(`26e26ec`).
  **원격(`origin/redesign`)보다 8커밋 앞섬, 푸시 안 함.** 푸시는 사용자가 "푸시해"라고 할 때만.
- Vercel 환경변수 `NEXON_API_KEY` 등록됨(2026-11-10, Secret, Production + Preview, 사용자).
- `vendor/` 는 git 밖(`.gitignore` · tsconfig `exclude` · eslint `globalIgnores`) — 핀볼 원본 참고용, 광고 코드 · 인물 그림을 공개 저장소에 안 올림.

## 다음 할 일

1. **썬데이 매주 자동 갱신(C) — 사용자가 원함(2026-11-10)**: 금요일 10시(KST) 사이트가 스스로 → Vercel Cron(Hobby 는 그 시간 안 아무 때 · 재시도 없음 → 12시쯤 예비 실행) → 넥슨 공지 API 로 썬데이 공지 찾기 → 공지 이미지 글자 읽기 → 아는 혜택 이름과 맞추기(처음 보는 혜택은 "확인 필요") → Supabase 표에 저장.
   **OCR 시험(2026-11-10, 10장 · 혜택 50개)**: PaddleOCR 한국어 v5(ppu-paddle-ocr, 흑백 전처리) 50/50 · 장당 약 1.2초, tesseract.js 45/50, EasyOCR 못 돌림. 전체 167주(혜택 556개)도 Paddle 548개(98.6%), 진짜 읽기 실수는 2주뿐이고 나머지는 매칭 규칙(묶음 공지 · 챌린저스 전용 · TIP 오탐) 문제. 결과 · 코드 `C:/dev/_work/sunday-ocr-test/README.md`.
   **결정(2026-11-10 사용자)**: PaddleOCR + 흑백 전처리, Vercel Cron. 자동 결과는 바로 확정하지 않고 숫자 빠짐 · 낮은 유사도 · 처음 보는 혜택 · 묶음 공지는 "확인 필요".
   **진행**: 1) OCR 경로 `app/api/cron/sunday/route.ts`(지금은 `?img=` 이미지 하나 읽기만) + `lib/sunday/ocr.ts`, 로컬 `next start` 로 확인(첫 실행 3.3초 · 다음 0.2초), Codex 리뷰 지적 없음.
   `CRON_SECRET` 등록됨(2026-11-10 사용자, Vercel Production + Preview, `.env.local` 에도). 커밋 `16c42b8` 푸시, Preview 빌드 성공 · 실제 공지 읽기 확인(2026-11-10, 첫 실행 7.7초, 혜택 4개 모두).
   **2단계 완료(2026-11-10 커밋)**: Cron 경로 = 이번 주 공지 찾기(`lib/sunday/notice.ts` · `notice-parse.ts`) → 이미지 OCR(`ocr.ts`, 줄 단위) → 매칭(`match.ts`, 기록 안 함 목록 `ignored.ts`) → 결과 JSON(`auto-update.ts`). 저장은 아직 없음. `?sunday=` 로 다른 주 조회 가능.
   채점 `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON eval-match.mjs --leave-one-out`(`C:/dev/_work/sunday-ocr-test/bench`, 줄 데이터 `results/lines-all.json`): 167주 중 자동 145 · **자동인데 틀림 0** · 확인 필요 22, 혜택 하나 숨김 시험 559번 중 그냥 저장 0. `match.test.ts` 가 규칙마다 실제 OCR 한 주(`match.fixtures.json`)로 고정.
   기록 수정: 2026-07-19 를 공식 이미지대로 솔 에르다 타임 세부 4개로(인벤 날짜별 목록이 한 줄로 줄임, 종류별 목록은 "사냥 솔 에르다 3배" 빠뜨림) — `_work/maple-sunday-data/src/checks.json` `fixes` + `build.mjs` 가 적용(백업 `checks.backup-2026-11-10.json`). 예측 고정 점수 그대로.
   Codex 리뷰(기본 모델, `16c42b8` 포함) 지적 2개 반영: 괄호 속 숫자("(30분)")도 검증, 날짜 줄을 못 읽어도 챌린저스 구역 자르기. 재확인 approve.
   남은 일: 넥슨 목록은 진행 · 예정 이벤트만 주고 끝난 공지 본문은 400 — **금요일 공지가 목록에 바로 뜨는지 첫 금요일(2026-11-13)에 확인 필요**. 그다음 3단계 Supabase 표 · Cron 등록 · "확인 필요" 처리 화면(공지 없음 `notice: null` 을 "혜택 없음"으로 저장하지 않게).
   함정: Cron 은 HTTP 경로만 부를 수 있어 "API route 없음" 규칙의 예외. onnxruntime 본체(`libonnxruntime.so.1`)는 파일 추적에 안 잡혀 `next.config.ts` `outputFileTracingIncludes` 로 넣음(빼면 Vercel 에서 실패). 모델은 `~/.cache` 대신 메모리로 받음(Vercel 은 홈 폴더 쓰기 불가). 함수 크기 로컬 89MB(Linux 추정 약 120MB, 한도 250MB), 다른 페이지 · 브라우저 코드에는 OCR 파일 없음.
   **사용자 결정 필요**: 서버 전용 쓰기 키(service role) 등록 · 마이그레이션 SQL 실행(사용자) — 3단계 준비와 같이.
   **그 전까지(A)**: 금요일 공지 뒤 사용자가 "썬데이 추가해" → 공지 이미지 읽고 `C:/dev/_work/maple-sunday-data/src/new-weeks.json` 에 추가 → `node scripts/build.mjs C:/dev/maple-dashboard/lib/sunday/data 2023-08-27` → `npm test` → 커밋. 안 하면 화면에 "기록 n주 밀림" 경고 · 예측 정확도 떨어짐.
2. **3단계 회원·권한**(아래 "개편 단계").
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

- 순서: 디자인 3안(아티팩트) → 사용자가 고른 안으로 화면 → 회원·권한 → 기능 추가. 코드·DB 는 안을 고른 뒤에.
- 2026-11-07 확인: 스케줄러·확률 API 는 **키 주인 계정 데이터만** → 숙제·강화 기록은 사용자 본인 API 키 필요. 스케줄러에 완료 여부 있음(14일까지), 스타포스 기록엔 메소 비용·아이템 레벨이 없어 비용을 직접 계산해야 함.
- **디자인: A안(메보스형) 확정(2026-11-07), 디자인 끝(2026-11-08, 캔버스 Version 71)** — 캔버스 https://claude.ai/artifact/2ECnKh4QSJB2znjRYUV7kk , 상세 [design.md](design.md).
  메뉴 = 홈 / 내 메이플(내 수익·숙제·보스 수익·강화 기록·알림) / 계산기(분배금·기댓값·MVP) / 정보 · 도우미(썬데이·숨은 스펙업·보스 도우미) / 놀이(핀볼). 캐릭터 검색 없음(숨은 스펙업만 예외), 로그인 = 아이디 또는 API 키, 로그인 상태 4가지, 아이콘 = lucide-react, 달력·요일 표기는 전부 일~토.
  중심 기능 = **내 수익**(화면 문구에 "부주" 안 씀), 보스 도우미 대상 = 카링·흉성·림보·발드릭스·유피테르.
- **캔버스 고치는 방법**: Artifact `read`(url + `paths`)로 `project/*.dc.html` 을 받아 고치고, 같은 `url` + `root` 로 게시(보드 위치·크기를 바꾸면 `project/canvas.json` 도). 검사 `node C:/dev/_work/maple-canvas/scripts/check-dc.mjs <project 폴더>` · `tags.mjs <파일들>`. 눈으로 확인: 보드 클릭 → "Zoom to selection" → PLAY → "Play full screen".
- 개편 전 보안 구멍(관리자 확인 없는 액션, 쿠키에 비밀번호 원문)은 명세 §5, 아직 열림 → 3단계에서 옛 관리자 방식을 통째로 없애며 닫는다.
- **2026-11-08 사용자 결정**: 기존 데이터는 옮기지 않고 새로 시작(백업 `C:\dev\_backup\maple-db-2026-11-08\`, git 밖). 옛 관리자 방식(`/admin`·`ADMIN_PASSWORD`·관리자 쿠키·액션)은 통째로 없앰.

## 개편 단계 (2026-11-08 사용자 지시 — 단계마다 보고하고 멈춤, 사용자가 "다음"이라고 하면 진행)

- **0단계 문서 정리** — 완료(`bfcbcc7`).
- **1단계 화면 A안 + 글꼴 + 분배금 계산기** — 완료(`6e2eb10`). 토큰 `globals.css`, 메뉴 `lib/nav.ts`, 없는 기능 = `app/[tool]/page.tsx` "준비 중", 글꼴 = Pretendard + 큰 숫자만 메이플 서체(`font-num`), Clarity `components/clarity.tsx`. 과정 · 함정 원문 history "개편 1단계".
- **2단계 공개 도구(로그인 없이)** — 완료(위 "도구별 요점").
- **3단계 회원·권한**(명세 §1·§5): 냠냠과 같은 Supabase 프로젝트 → 전체 인증 설정·`nyamnyam` 스키마 안 건드림, 가입 = 서버 `auth.admin.createUser` + `app_metadata.app = "maple"`, 로그인은 그 계정만, service role 서버 전용.
  아이디 로그인(가상 이메일)·API 키 로그인(ouid). 새 테이블 `user_id NOT NULL` + RLS `auth.uid() = user_id`. 옛 public 테이블·트리거·함수 삭제는 새 사이트 배포 때(SQL 은 실행 전에 보여 줌).
  옛 관리자 방식 삭제. 대시보드 설정·키 입력은 사용자가(할 일 목록으로 줌). 개인정보처리방침 페이지(Clarity 수집 내용 포함, 캡처 이미지는 서버로 안 보냄·비회원 키는 브라우저에만도 적기). Codex 리뷰 기본 모델.
- **4단계 로그인 뒤 기능**(기능마다 보고하고 멈춤): ① **내 수익**(로그인만, API 키 없이도 — 캡처 읽기는 브라우저 Tesseract.js) → ② API 키 등록·암호화 저장(여러 개) →
  ③ 숙제 → ④ 보스 수익(비회원 이번 주 조회 = 브라우저 직접 호출, CORS 확인 포함) → ⑤ 홈 "이번 주" → ⑥ 강화 기록 → ⑦ 알림 → ⑧ 보스 패턴 도우미.
  (내 수익을 맨 앞에 둔 건 Claude 판단 — 순서는 사용자가 바꿀 수 있음.) 넥슨 API 는 서버에서만, 하루 1,000건 제한이라 캐시, "Data based on NEXON Open API" 표기, 저장한 데이터는 30일 안에 갱신.

## 기술 스택

- Next.js 16.4.3 (App Router, Turbopack), React 19.2.8, TypeScript. 이 Next 버전은 학습 데이터보다 최신 → `node_modules/next/dist/docs/` 를 직접 참고.
- Tailwind CSS v4 (`@custom-variant dark (&:where(.dark, .dark *))`), `next-themes` (다크모드).
- 글꼴 = Pretendard(`fonts/Pretendard/`) + 큰 숫자만 메이플스토리 서체(`fonts/Maplestory/`, `font-num`).
- **shadcn/ui** (style `base-nova`, Base UI 기반) — `components/ui/*`, 새 컴포넌트는 `npx shadcn@latest add <name>`.
  주의: `shadcn init` 이 `app/globals.css` · `app/layout.tsx` 를 덮어쓴 적 있음(Geist 폰트) → CLI 뒤 두 파일 diff 확인. `globals.css` 에서 **`:root`(라이트)가 반드시 `.dark` 보다 먼저**(명시도가 같아 순서가 뒤집히면 다크모드가 라이트 색으로 남음).
- Supabase(Postgres) — `@supabase/supabase-js`, **서버에서만**(Server Components / Server Actions), `SUPABASE_URL` / `SUPABASE_ANON_KEY`(NEXT_PUBLIC_ 아님). 데이터 변경은 전부 Server Actions, 클라이언트 fetch/API route 없음.
- 캐싱: `unstable_cache` + `updateTag`("Previous Model" 유지, 의도적 선택). 시간에 따라 바뀌는 페이지는 `export const revalidate = 3600`(썬데이 · 홈).
- Vercel 함수 리전 `icn1` 고정(`vercel.json`).
- 환경변수(`.env.local`, gitignored, 값은 출력 · 커밋 · 문서 기록 금지): `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `ADMIN_PASSWORD`(3단계 운영 배포 뒤 삭제) · `NEXON_API_KEY`. 키 이름은 `.env.local.example`.

## 개편 전 앱(옛 코드, 3단계에서 삭제 예정)

- 부주 정산 `/settlement`(메뉴에서만 빠짐) · 관리자 `/admin` · 정산 계산 `lib/settlement-math.ts` · 캐시 `lib/queries.ts`. 설명 원문은 history "개편 전 앱 설명".
- 보스 분배금 계산 `lib/boss-split-math.ts`(chuchu.gg 산식)는 1단계에서 새 화면으로 옮겨 계속 씀.

## 세션 기록 (자세한 원문은 history)

- 2026-11-08: 0단계 · 1단계 커밋, 2단계 기댓값 · MVP · 핀볼.
- 2026-11-09: 2단계 1~14차 수정, 어빌리티 "뜬 옵션" 칩, 숨은 스펙업 데이터 · 규칙 · `/spec` 화면.
- 2026-11-10: 잠재 탭 개선 커밋, 썬데이 지난 기록 데이터 · 예측 시험 · `/sunday` 화면(`27e4bdc`), 로고 = 앱 아이콘(`26e26ec`), handoff 30KB → 정리(원문 history "2026-11-10 정리").
