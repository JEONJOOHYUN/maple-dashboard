# 메이플 대시보드 — 부주 정산

메이플스토리 부주 사냥 수익을 기록하고, 실시간 시세로 정산 금액을 계산하는 대시보드입니다.
여러 메이플 관련 도구를 탭으로 추가할 수 있도록 구성되어 있고, 지금은 "부주 정산" 도구 하나만 있습니다.

## 1. Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만듭니다.
2. 프로젝트의 SQL Editor에서 [`supabase/schema.sql`](./supabase/schema.sql) 내용을 실행해 `hunting_logs` 테이블을 만듭니다.
3. 프로젝트 설정(Project Settings) > API 메뉴에서 **Project URL**과 **anon public key**를 복사합니다.
4. `.env.local.example`을 `.env.local`로 복사하고 값을 채웁니다.

```bash
cp .env.local.example .env.local
```

> 이 프로젝트는 개인용 도구로, 별도 로그인 기능 없이 anon key로 테이블 전체에 접근합니다.
> 외부에 공유되지 않길 원하면 Vercel의 배포 보호(Deployment Protection) 기능을 함께 사용하는 것을 권장합니다.

## 2. 아이콘 준비

`public/meso.png`, `public/fragment.png` 파일을 직접 추가해주세요. (코드에서는 이미 이 경로를 참조하고 있습니다.)

## 3. 로컬 실행

```bash
npm install
npm run dev
```

`http://localhost:3000`에서 확인할 수 있습니다.

## 4. Vercel 배포

1. 이 폴더(`maple-dashboard`)를 별도 GitHub 저장소로 만들거나, 모노레포로 올린다면 Vercel 프로젝트의 **Root Directory**를 `maple-dashboard`로 지정합니다.
2. Vercel 프로젝트의 Environment Variables에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 등록합니다.
3. 배포합니다.
