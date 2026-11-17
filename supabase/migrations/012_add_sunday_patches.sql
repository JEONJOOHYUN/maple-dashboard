-- 썬데이 시즌 패치 날짜(sunday_patches): 여름 · 겨울 큰 패치 날을 손으로 적지 않고 넥슨 이벤트 공지로 채웁니다.
-- 왜: 예측의 시즌 리듬(여름 패치 +1주 · 겨울 +2주에 큰 날)은 패치 날짜가 틀리면 엉뚱한 일요일을 짚습니다. 지금까지는
-- lib/sunday/data/patches.json 에 추정 날짜를 손으로 적고 공지가 나오면 고쳤습니다.
-- 누가 쓰나: Cron(app/api/cron/sunday)이 돌 때마다 넥슨 Open API 이벤트 공지를 보고(lib/sunday/patches.ts) 날짜가
-- 바뀌거나 확정될 때만 씁니다. 지난 시즌 패치 날 시작한 140일 넘는 이벤트가 끝나는 다음 날 = 추정(그런 이벤트가 없으면
-- 지난 패치 + 26주: 지금까지 6번 모두 26주 간격), 그날 새 이벤트가 시작되면 = 확정.
-- 읽기: 화면 · 예측 기록 · GitHub Actions 가 모두 patches.json 과 같은 방식으로 합쳐 씁니다(손으로 확인한 확정 날짜는 안 바뀜).
-- (season_key 한 줄: "2026-winter" 처럼 해와 계절. 1월로 밀린 겨울 패치는 12월의 해를 씁니다.)
-- 쓰기: 정책이 없으므로 서버 전용 키(service role)만, 넣기 · 바꾸기만(지우기 없음).
-- 권한(GRANT)을 직접 적습니다: 006 · 010 · 011 과 같은 이유(Supabase 는 public 의 새 표에 권한을 자동으로 주지 않음).
-- 여러 번 실행해도 안전합니다.

create table if not exists public.sunday_patches (
  season_key text primary key,                     -- "2026-winter"
  date date not null,                              -- 패치 날(목요일)
  season text not null check (season in ('summer', 'winter')),
  confirmed boolean not null default false,        -- false = 이벤트가 끝나는 날로 본 추정, true = 그날 새 이벤트가 시작됨
  basis text not null,                             -- 근거 종류: season-events · 26-weeks · patch-day · season-started (lib/sunday/patches.ts)
  evidence jsonb not null default '[]'::jsonb,     -- 근거로 쓴 이벤트 공지 [{ "title": ..., "start": ..., "end": ... }]
  updated_at timestamptz not null default now()
);

alter table public.sunday_patches enable row level security;

drop policy if exists "Anyone can read sunday patches" on public.sunday_patches;
create policy "Anyone can read sunday patches" on public.sunday_patches
  for select to anon, authenticated using (true);

-- 서버 전용 키에는 Supabase 기본값으로 모든 권한이 붙어 있어 먼저 빼고 읽기 · 넣기 · 바꾸기만 줍니다.
revoke all on public.sunday_patches from anon, authenticated, service_role;
grant select on public.sunday_patches to anon, authenticated;
grant select, insert, update on public.sunday_patches to service_role;
