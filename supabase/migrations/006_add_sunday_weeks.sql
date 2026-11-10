-- 썬데이 메이플 자동 갱신 결과(sunday_weeks)와 Cron 실행 기록(sunday_cron_runs).
-- 흐름: 넥슨 공지 → 이미지 글자 읽기 → 혜택 이름 맞추기 (app/api/cron/sunday).
--
-- 지난 기록은 lib/sunday/data/history.json 에 있고, 이 표는 그 뒤에 이어지는 주를 담습니다.
-- status
--   auto      : 모든 혜택을 확실히 맞춰 바로 공개
--   review    : 확인 필요(숫자 불일치 · 처음 보는 제목 등). 사람이 확인하기 전에는 공개하지 않음
--   confirmed : 사람이 확인(또는 고침)해서 공개
--
-- 읽기: 누구나 공개된 주(auto, confirmed)만. 쓰기: 정책이 없으므로 서버 전용 키(service role)만.
-- 권한(GRANT)을 직접 적습니다: Supabase 는 2026-10-30 부터 public 의 새 표에 권한을 자동으로 주지 않아,
-- 적지 않으면 RLS 정책이 있어도 화면(anon 키)과 서버 키 모두 이 표를 읽고 쓰지 못합니다.
-- 표 이름에 public. 을 붙여, 같은 프로젝트의 다른 스키마(nyamnyam)에 만들어질 일이 없게 합니다.
-- 여러 번 실행해도 안전합니다.

create table if not exists public.sunday_weeks (
  sunday date primary key,
  status text not null check (status in ('auto', 'review', 'confirmed')),
  notice_id integer,
  notice_title text,
  special boolean not null default false,
  items jsonb not null default '[]'::jsonb,   -- [{ "name": "...", "tags": ["샤이닝 스타포스 타임"] }]
  review jsonb not null default '[]'::jsonb,  -- 확인 필요 사유 [{ "kind": "number", "line": "...", "guess": "..." }]
  images jsonb not null default '[]'::jsonb,  -- 공지 이미지 주소
  ocr_lines jsonb,                            -- 읽은 줄 [{ "t": "글자", "h": 줄 높이 }] (확인할 때 참고, 다시 맞춰 볼 때 사용)
  read_at timestamptz not null default now(),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.sunday_weeks enable row level security;

drop policy if exists "Anyone can read published sunday weeks" on public.sunday_weeks;
create policy "Anyone can read published sunday weeks" on public.sunday_weeks
  for select to anon, authenticated using (status in ('auto', 'confirmed'));

-- 화면(anon · 로그인 사용자)은 읽기만, 그것도 위 정책이 허락한 공개 행만. 서버 전용 키는 읽기 · 쓰기.
revoke all on public.sunday_weeks from anon, authenticated;
grant select on public.sunday_weeks to anon, authenticated;
grant select, insert, update, delete on public.sunday_weeks to service_role;

-- Cron 실행 기록: Vercel 무료 요금제는 정한 시각부터 1시간 안 아무 때나 실행하고 로그도 1시간만 남깁니다.
-- 실제로 몇 분에 돌았는지, 공지를 얼마나 늦게 잡았는지 보려고 남깁니다. 읽기 · 쓰기 모두 서버 전용 키만.
create table if not exists public.sunday_cron_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  sunday date not null,
  result text not null, -- no-notice | in-history | already-published | review-unchanged | auto | review | dry-run | error
  ms integer,
  detail text
);

create index if not exists sunday_cron_runs_ran_at_idx on public.sunday_cron_runs (ran_at desc);

alter table public.sunday_cron_runs enable row level security;

-- 정책이 없으니 anon · 로그인 사용자는 어차피 못 보지만, 권한도 빼 둡니다. id 는 identity 열이라
-- 표에 insert 권한만 있으면 번호가 매겨집니다(시퀀스 권한을 따로 줄 필요 없음).
revoke all on public.sunday_cron_runs from anon, authenticated;
grant select, insert, delete on public.sunday_cron_runs to service_role;
