# maple-dashboard — 프로젝트 핸드오프 문서

메이플스토리 도구 모음(내 수익 · 계산기 · 정보 도우미) — 전면 개편 중인 독립 Next.js 프로젝트. (포트폴리오 `C:\dev\portfolio` 와는 별개.)

- GitHub: https://github.com/JEONJOOHYUN/maple-dashboard (public)
- Vercel: 프로젝트 `maple-dashboard`, 배포 URL https://maple-dashboard-eta.vercel.app
- Supabase: 프로젝트 id `dwxntehggzojbzbeydxm`, region `ap-northeast-2` (Seoul), Free/NANO tier
  (약 1주 미사용 시 자동 일시정지됨 — 오랜만에 접속하면 첫 요청이 느릴 수 있음)

> 지금 상태·결정·함정만 둔다. 디렉터리 구조 · DB · 기술 스택은 [structure.md](structure.md), 작업 규칙은 [../CLAUDE.md](../CLAUDE.md). 환경변수 값은 출력 · 커밋 · 문서 기록 금지.
> 지난 기록 원문은 [history.md](history.md)(1단계 과정, 2단계 세션 기록 · 도구 상세, 디자인 과정, 개편 전 앱, 2026-11-10 정리분). 정리 전 원본 `C:\dev\_backup\handoff-2026-11-10\`.

## 현재 상태 (2026-11-12)

- 운영(`main`) = `redesign` 과 같은 커밋. 2026-11-11 두 번 배포(개편판 `30d4f73`, 이어서 기댓값 계산기 수정), **2026-11-12 강화 기록 `/enhance` 배포(운영 5번째) · 키 여러 개 배포(6번째) · 서비스 단계 안내 · 속도(7번째) · 속도 250건(8번째) · 공용 아이템 사전 · 월드 묶음 · 큐브 메소 · 12성 미만 숨기기(9번째, 저녁)**. 되돌리기 = Vercel Rollback(단 `008` 로 옛 표가 없어 개편 전 화면은 못 살림).
- 개편(`redesign`) = `main` 과 같은 커밋, 원격과 같음. 다음 작업도 `redesign` 에서 하고 끝나면 `main` 에 올림. 푸시 · `main` 합치기는 사용자가 말할 때만.
- 2026-11-11 밤 배포분(운영 4번째) = 썬데이 B안 가로 띠 · 월요일 0시 전환 등, 원문 history "2026-11-12 정리" · "2026-11-12 정리(3)". 운영에서 볼 것: 금요일 공지 저장 직후 화면 반영, 월요일 0시 전환.
- 시안: 썬데이 배치 https://claude.ai/artifact/JN9fZmaSavhep1Lkcygy58 (B 확정), 링크 썸네일 https://claude.ai/artifact/5fFzDWih8azsAqPL1nHdM4 (C 확정 · `app/opengraph-image.jpg`, 다시 만들기 = `C:/dev/_work/maple/og/og.html` 고치고 프로젝트 폴더에서 `node C:/dev/_work/maple/og/build.mjs`).
- 로그인 작업 = 로컬 브랜치 `members`(`redesign` 위, 푸시 안 함). 아래 "다음 할 일" 2번.
- Vercel 환경변수 `NEXON_API_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `CLOVA_OCR_URL` · `CLOVA_OCR_SECRET` 등록됨(Production + Preview, 이름만 확인).
- `vendor/` 는 git 밖(`.gitignore` · tsconfig `exclude` · eslint `globalIgnores`) — 핀볼 원본 참고용, 광고 코드 · 인물 그림을 공개 저장소에 안 올림.

## 다음 할 일

0. **지금 순서(2026-11-11 사용자 확정) — 새 세션은 여기부터**: 로그인 방식은 넥슨 답을 본 뒤 정하고, 그 전에 메인을 올린다.
   1 ~ 3. ~~로그인 코드 보관(`members` 브랜치)~~ · ~~메인 올리기(2026-11-11, `008` 실행됨)~~ · ~~기댓값 계산기 손보기~~ · ~~강화 기록 `/enhance`(2026-11-12)~~ — 끝. 원문 history "2026-11-11 메인 올리기" · "2026-11-11 기댓값 계산기 교차 검증" · "2026-11-12 강화 기록 배포" · "2026-11-12 정리(6)".
      - 방침: 지금 있는 것만 적음 → **`/enhance`(키) · 캡처 · 회원 기능을 열 때 방침부터 고치고 `EFFECTIVE_DATE` 바꾸기.** (`/enhance` 는 2026-11-12 반영 · 날짜도 2026-11-12.) 연락처 maplestorydashboard@gmail.com. 검증 기록 · 사실 확인 출처는 history "2026-11-11 메인 올리기".
      - 사용자 남은 것: Vercel `ADMIN_PASSWORD` 삭제(코드에서 안 씀, 옛 값이 git 기록에 남아 있음). 옛 데이터는 백업 `C:\dev\_backup\maple-db-2026-11-08\` 뿐.
      - **사용자가 정한 정의(바꾸지 말 것)**: 방무 = 줄 수치 단순 합(30 + 40 = 70) · 소울 "공 + @" 는 공 3줄도 성공 · 썬데이는 명성치만 절반(메소 그대로) · 천장 = N번 실패 뒤 다음 번 확정 · 스타캐치 항상 적용 · 무기 추옵 보공 추당 2%. 레벨별 최대 별 = 5 / 8 / 10 / 15 / 20 / 30성(경계 95 · 108 · 118 · 128 · 138, 테스트로 고정).
      - 강화 기록 남은 것: 사용자가 Vercel `NEXON_API_KEY` 를 서비스 키로 바꿨는지 확인 → 숨은 스펙업 호출 간격(220ms)을 환경변수로 풀기, 숨은 스펙업 IP 별 속도 제한 규칙(Vercel 방화벽, 무료 1개), 넥슨 서비스 키 · Vercel 방어 조사 내용 brain 저장 여부(사용자 답 대기). 못 해 본 것: 서로 다른 두 키로 오가기, 실제 개발 키의 거절 → 느린 속도 전환. 내용 = enhance.md "키 여러 개".
      - **2026-11-12 저녁(운영 9번째 `ce8ae98`)**: 공용 아이템 사전(`009` 실행됨, 운영 저장 확인) · 같은 급 옵션 판정 · 기존 옵션 평균 · 큐브 메소(120제 이하는 통찰력) · 월드 3묶음(이벤트는 처음부터 꺼짐) · 12성 미만 숨기기 · README = 서비스 소개. 내용 = enhance.md "2026-11-12 저녁 작업" · "공용 아이템 사전".
      - 못 본 것: 다른 계정 · 기기에서 사전 그림이 뜨는지, 횟수 제한이 실제로 막는지. 한계: 잠재능력의 월드는 추정(처음부터 좁은 기간만 본 브라우저는 리프한 캐릭터를 일반으로 봄).
      - 사용자 답 대기(저녁): 기존 옵션 줄을 띠 · 손익에도 넣을지(지금은 읽기용), 사전을 랭킹 상위 캐릭터 장비로 미리 채울지(Claude 제안).
      - 사용자 답 대기: 잠재능력 "행운의 아이템" 칸을 뺄지, 메뉴 이름 "강화 기록" 유지(Claude 추천) 여부, 기존 옵션을 그대로 둔 카드의 손익을 "제외"로 둘지 쓴 메소만큼 손해로 볼지(지금 "제외").
      - 확인 못 한 것: 모자 쿨감 실제 기록(테스트로만), 장비 조회 실패 처리(코드로만 · 자동 테스트 없음). 무기 부위 이름은 확인됨(2026-11-12 실제 큐브 기록 = "무기").
      - 3011 확인 서버가 켜져 있을 수 있음(백그라운드) → 포트를 잡은 PID 를 찾아 끄기. 사용자는 실제 키를 넣어 3011 에서 봄(localhost 저장분은 운영 주소와 별개).
   4. **보스 도우미**(카링부터, 명세 §4-4) → 메인에 추가.
   5. **넥슨 답 뒤**: 로그인 방식 결정(후보 = 구글 주 + 아이디 보조 / API 키 로그인) → `members` 브랜치 이어서 → 내 수익 · 보스 수익 · 숙제 · 알림(매일 · 원하는 시각).
   - 넥슨 문의 글 = `C:/dev/_work/maple/nexon-inquiry-2026-11-12.txt`(사용자가 2026-11-12 보냄 예정). 비밀번호 찾기: 아이디만으로는 방법 없음 → 구글 연결로 재설정하는 안을 Claude 가 추천, 사용자 결정 전.
1. **썬데이 매주 자동 갱신 — 코드 끝**(`2c09756` 푸시 · Preview READY, 2026-11-11): Cron → 공지 찾기 → CLOVA OCR → 혜택 맞추기(모르면 "확인 필요") → `sunday_weeks` 저장 → 화면. 과정 · 채점 · 결정 원문 history "2026-11-11 정리".
   - **남은 것**: 2026-11-13(금) 공지로 Preview 에서 전체 흐름 확인(사용자 "썬데이 확인해"), 그 공지가 넥슨 목록에 바로 뜨는지도. Cron(`vercel.json`, 주 20번)은 Production 에서만 → 2026-11-11 `main` 배포로 켜짐(첫 실행 결과는 `sunday_cron_runs` 로 확인 필요), 늦으면 외부 알람(미정).
   - CLOVA = 월 100회 무료(이미지 1장 = 1회), 2026-11 남은 18회. `?dry=1` 도 호출을 씀. 아직 안 읽은 옛 공지 92주는 다음 달 `run-clova.mjs`(`C:/dev/_work/sunday-ocr-test/README.md`).
   - "확인 필요" 주는 회원 기능 전까지 대화로 처리(이미지 · 읽은 글자 보여 주고 승인하면 서버 키로 확정). 안 고친 검토 항목: C 공개 행의 모든 열 노출(승인 안 받음).
   - 함정: Cron 은 HTTP 경로만 불러 "API route 없음" 규칙의 예외.
   **그 전까지(A)**: 금요일 공지 뒤 사용자가 "썬데이 추가해" → 공지 이미지 읽고 `C:/dev/_work/maple-sunday-data/src/new-weeks.json` 에 추가 → `node scripts/build.mjs C:/dev/maple-dashboard/lib/sunday/data 2023-08-27` → `npm test` → 커밋. 안 하면 화면에 "기록 n주 밀림" 경고 · 예측 정확도 떨어짐.
2. **3단계 회원 — 로그인 코드는 `members` 에 보관, 넥슨 답 뒤 이어 감**: 시안 A안 https://claude.ai/artifact/V18FVp2aMS7Ykr5RuYjcaZ , `007` 실행됨(`nexon_accounts` · `rate_counters` · `counter_hit()`). 들어 있는 파일 · 결정(아이디 규칙 · RLS · 키 암호화) · 과정 원문 history "2026-11-11 정리".
   - **사용자 대기**: `members` 배포 전 Vercel `MAPLE_KEY_SECRET`(`.env.local` 과 같은 값) 등록, 시험 계정 `claude_test1` 삭제 여부, 구글 로그인 추가(Auth 설정이 냠냠과 공유).
   - 넥슨 약관 제5조: 스타포스 · 큐브 조회 API 는 다른 사람에게 제공 가능(공지 2023-12-21 notice/2449064) → 강화 기록 근거 있음. 스케줄러 · ouid 는 미확인 → 넥슨 문의 답 대기.
   - **함정: openapi.nexon.com 문서 화면(game/…)은 로그인 상태면 사용자 API 키 전체가 보임 → 열지 말 것**(공지 · 약관 화면은 안전).
3. ~~파일 정리~~ — 완료(2026-11-12 밤): 개편 전 SQL 삭제 · env 예시 / `AGENTS.md` / `.claude/` 를 git 밖으로(`235a432`), 코드를 기능별 폴더로(`d27f27f`), 문서 줄이기, **`CLAUDE.md` · `.agents/` 를 git 에서 내림**(파일은 PC 에, 백업 `C:\dev\_backup\`). `members` 브랜치에는 이 문서들이 아직 있음 → 이어 갈 때 rebase 에서 지움.
- 숨은 스펙업 남은 것: 하루 한도 안내 · 보약 찾는 방식 · 유니온 프리셋 · 5차 공용 코어 목록 · 조회 더 빠르게 — 원문 history "2026-11-12 정리(3)".
- **확인 필요(사용자)**: 썬데이 테마 이름 "옵션 강화"(Claude 추천), 추옵 탭 환산 기본값(올스탯1%=10 · 공1=4)을 잠재 탭 maplescouter 환산에 맞출지, MVP 크레딧 적립 5%(maple-mvp.com 기준), 에디 방어구 주스탯 합에 9레벨당 · 공 정수를 안 세는 부분, 잠재 장갑 · 모자의 주스탯 줄에 낮은 값(9% 등)도 셀지(지금 셈).
- **새 파일은 기능별 폴더 규칙대로**: 화면 `app/<경로>/page.tsx` 는 얇게, 부품 `components/<기능>/`, 계산 · 데이터 · 테스트 `lib/<기능>/`.

## 도구별 요점 (상세 · 수치는 history "2026-11-10 정리", 명세 §4)

- **기댓값** `/ev`(스타포스 · 잠재 · 추옵 · 소울 · 어빌리티 5탭): 계산 `lib/ev/*.ts`, 공식 확률표 `lib/ev/data/potential.json` · `ability.json`(다시 받기 `C:/dev/_work/maple-ev-data/`), 기본값 `lib/ev/defaults.ts`.
  사용자 결정: 서큘레이터 개수 = (1 − P) ÷ P, 천장 = N번 연속 실패 뒤 다음 번 확정, 메소를 항상 먼저, 정해진 재설정 비용은 글자만, 방어구 · 장신구 주스탯 목표 = maplescouter 환산(`ev:statConv`), 잠재 공 · 마 선택 칸 없음(두 줄 확률 같음), 특수 직업 = 일반 / 제논 · 올스탯 / 데벤 · HP(`ev:mainStat`), 장갑 · 모자 = 크뎀/쿨감 줄 − + · 주스탯 줄 − +(`comboChance`).
- **MVP** `/mvp` = C안 효율 순위판(`lib/mvp/mvp.ts`, 저장 `mvp:settings2`).
- **핀볼** `/pinball` = `lib/third-party/roulette/`(원본 lazygyu/roulette MIT, 코스 "Wheel of fortune", 물리 `box2d-wasm@7.0.0`).
- **숨은 스펙업** `/spec`: 닉네임 → 서버에서 넥슨 API 13회(220ms 간격 큐) → 규칙 검사(`lib/spec/check.ts`, 직업 데이터 `lib/spec/data/classes.json`) → 3시간 캐시(`RULES_VERSION` 올리면 옛 캐시 안 씀). 칭호는 지금 낀 칭호만.
- **강화 기록** `/enhance`(스타포스 + 잠재능력, 2026-11-12): 화면 `components/enhance/`, 계산 `lib/enhance/` + 테스트. 구조 · 손익 계산 · API 사실 · 받기 / 저장 · 다시 확인하는 법 = [enhance.md](enhance.md).
- **썬데이** `/sunday` + 홈 카드: 데이터 `lib/sunday/data/history.json`(2023-08-27 ~, 사용자: 옛날 것 빼기) · `benefits.json`, 예측 `lib/sunday/predict.ts`(샤이닝 · 미라클 주기 → 나머지 묶음 hazard × 최근 빈도, 학습 2025-03-23 ~, 3개는 종류별로 섞어 고름 → 최근 52주 38/52, maplessunday 27주 24 vs 우리 22), 테스트가 이 점수를 고정.
  테마 3개 = 스타포스 / 옵션 강화 / 사냥, "테마마다 나올 확률"(합이 100% 넘음). 묶음 = 늘 같이 나오는 혜택(룬 + 콤보킬 + 룬 재등장, 몬컬 + 모몽 + 엘몹 등, `lib/sunday/bundles.ts`). 페이지 · 홈은 요청마다 렌더링(DB 행만 1시간 캐시).
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
- `next/script` 의 `id` 는 라이브러리 전역 이름과 겹치지 않게(`id="clarity"` 가 `window.clarity` 를 가려 2026-11-12 까지 수집 0건 → `ms-clarity`). 확인 = 운영에서 `typeof window.clarity === "function"`. 원문 history "2026-11-12 정리(6)".
- Next 이미지 최적화: 주소가 같으면 브라우저가 예전 그림을 캐시에서 씀 → 바뀌는 그림은 정적 import(내용 해시 주소).
- **화면 파일을 옮기거나 지운 뒤 `next build` 가 `.next/dev/types/validator.ts` 타입 오류로 실패**(2026-11-12): `next dev` 가 남긴 낡은 타입 캐시 → `.next/dev/types` 를 지우고 다시 빌드. 빌드가 실패한 줄 모르고 `next start` 를 켜면 "Could not find a production build" 로 서버가 안 뜸 → 빌드 뒤 `.next/BUILD_ID` 확인.

## 전면 개편 계획 → [project-spec.md](project-spec.md)

- 2026-11-07 확인: 스케줄러·확률 API 는 **키 주인 계정 데이터만** → 숙제·강화 기록은 사용자 본인 API 키 필요. 스케줄러에 완료 여부 있음(14일까지), 스타포스 기록엔 메소 비용·아이템 레벨이 없어 비용을 직접 계산해야 함.
- **디자인: A안(메보스형) 확정(2026-11-07), 디자인 끝(2026-11-08, 캔버스 Version 71)** — 캔버스 https://claude.ai/artifact/2ECnKh4QSJB2znjRYUV7kk , 상세 [design.md](design.md).
  메뉴 구성 · 로그인 상태 4가지 · 달력은 일~토 = 명세 §2. 중심 기능 = **내 수익**(화면 문구에 "부주" 안 씀), 보스 도우미 대상 = 카링 · 흉성 · 림보 · 발드릭스 · 유피테르.

## 개편 단계 (2026-11-08 사용자 지시 — 단계마다 보고하고 멈춤, 사용자가 "다음"이라고 하면 진행)

- **0 · 1 · 2단계** — 완료(위 "도구별 요점"). 없는 기능 = `app/[tool]/page.tsx` "준비 중". 과정 history "개편 1단계" · "2026-11-12 정리(6)".
- **3단계 회원·권한**(명세 §1·§5): 냠냠과 같은 Supabase → 전체 인증 설정 · `nyamnyam` 스키마 안 건드림, 가입 = 서버 `auth.admin.createUser` + `app_metadata.app = "maple"`, service role 서버 전용. 새 테이블 `user_id NOT NULL` + RLS. 옛 public 표 삭제 SQL 은 배포 때 보여 주고 실행. Codex 리뷰 기본 모델.
- **4단계 로그인 뒤 기능**(기능마다 보고하고 멈춤, 2026-11-11 순서): ① 내 수익(캡처 읽기는 브라우저 Tesseract.js) → ② API 키 등록 → ⑥ 강화 기록 → 넥슨 답 뒤 ③ 숙제 · ④ 보스 수익 · ⑤ 홈 "이번 주" · ⑦ 알림 → ⑧ 보스 패턴. 넥슨 API 는 서버에서만, 하루 1,000건 제한이라 캐시, 저장 데이터는 30일 안에 갱신. 위 0번 순서가 우선.

## 세션 기록 (자세한 원문은 history)

- 2026-11-12(밤): 파일 정리 4묶음(공개 파일 · 코드 폴더 · 문서 줄이기 · `CLAUDE.md` / `.agents/` 를 git 밖으로), 다크 모드를 기본값으로.
- 2026-11-12(저녁): 공용 아이템 사전 · 월드 3묶음 · 큐브 메소 · 기존 옵션 평균 · 12성 미만 숨기기 · README → 운영 9번째 `ce8ae98`. Codex 리뷰 5회(지적 5건 반영).
