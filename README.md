# 메이플 대시보드

메이플스토리 하면서 필요한 계산과 기록을 모아둔 개인용 사이트입니다.

https://maple-dashboard-eta.vercel.app

## 뭘 할 수 있나요

- **부주 정산** — 부주가 사냥한 순수 메소와 솔 에르다 조각을 날짜별로 기록하고, 조각을 시세대로 팔아 메소로 바꾼 뒤 현금화 비율을 적용해 최종 정산 금액을 계산합니다. 부주별로 탭을 나눠 관리하고, 활동 달력으로 누적 현황을 봅니다.
- **보스 분배금** — 보스 아이템 판매액을 파티원끼리 나눌 때, 수수료까지 반영해서 각자에게 실제로 보내야 할 메소를 계산합니다.
- **관리자 페이지** — 비밀번호를 넣으면 모든 기록을 직접 수정하거나 삭제할 수 있습니다.

## 개발

Next.js + Supabase로 만들었고 Vercel에 배포되어 있습니다.

```bash
cp .env.local.example .env.local   # SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_PASSWORD 입력
npm install
npm run dev
```

DB 스키마는 [`supabase/schema.sql`](./supabase/schema.sql)에 있습니다.
