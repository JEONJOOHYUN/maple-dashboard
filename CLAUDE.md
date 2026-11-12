# maple-dashboard — 핵심 규칙

메이플스토리 도구 모음 — 계산기 · 썬데이 · 숨은 스펙업 · 강화 기록 · 핀볼 (Next.js 16, Supabase, shadcn/ui `base-nova`).
상위 지침 `C:\dev\CLAUDE.md` 와 함께 적용된다 — 서로 부딪히면 이 파일이 우선한다.
**작업 전에 `.agents/handoff.md`(지금 상태·결정·함정)를 읽고, 파일·테이블을 찾을 때는 `.agents/structure.md` 를 본다.**

- 답변·보고·화면 문구는 한국어. 코드 주석·식별자는 영문.
- 이 Next 버전은 학습 데이터보다 최신이다. 코드를 쓰기 전에 `node_modules/next/dist/docs/` 를 확인한다.
- Supabase 는 서버에서만(Server Components / Server Actions). 데이터 변경은 전부 Server Actions, 클라이언트 fetch·API route 없음
  (예외 둘: 강화 기록은 브라우저가 넥슨을 직접 호출, 썬데이 Cron 은 `app/api/cron/sunday`).
- 새 UI 는 shadcn 컴포넌트 먼저(`npx shadcn@latest add <이름>`). shadcn CLI 를 돌린 뒤에는 `app/globals.css`·`app/layout.tsx` diff 를 꼭 확인
  (Paperlogy 글꼴·토큰을 덮어쓴 적 있음, `:root` 가 `.dark` 보다 먼저 와야 함).
- 숫자 입력은 `number | ""` 상태 + `numberInputHandler`. `Number(e.target.value)` 만 쓰지 않는다.
- `.env.local` 의 값(Supabase 키·관리자 비밀번호)은 출력·커밋·문서 기록 금지. 이 저장소는 공개다.
- 기능 추가 후에는 실제(또는 안전하게 되돌릴 수 있는) Supabase 데이터로 브라우저에서 직접 검증한 뒤에만 커밋.
- 스키마 변경은 항상 `supabase/migrations/` 에 멱등성 있는 SQL 파일로 남기고, 사용자가 실제 DB 에 실행 확인한 뒤 기능을 쓴다.
- 커밋은 사용자 확인 후, 푸시는 사용자가 "푸시해"라고 할 때만.
- 작업 단위가 끝나면 `.agents/handoff.md` 를 갱신한다. 새 도구가 추가되면 포트폴리오의 `maple-dashboard` 항목도 함께 갱신.
- 이 파일과 `.agents/` 는 git 밖이다(2026-11-12 사용자 결정, 공개 저장소에 작업 문서를 안 올림). 커밋 대상이 아니고,
  문서를 크게 정리하기 전에는 `C:\dev\_backup\<무엇>-<날짜>\` 에 복사해 둔다.
