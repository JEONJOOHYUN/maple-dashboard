-- 개편 3단계 회원 · 권한: 넥슨 계정 연결(nexon_accounts)과 횟수 세기(rate_counters).
--
-- 회원 자체는 Supabase Auth(auth.users)에 있습니다. 같은 프로젝트를 냠냠캔버스가 함께 쓰므로
-- 메이플 회원은 서버가 만들 때 app_metadata.app = 'maple' 을 붙이고(사용자가 바꿀 수 없는 값),
-- 아래 정책은 "본인 행" + "메이플 회원" 둘 다 맞을 때만 읽게 합니다. 냠냠 계정은 로그인해도 못 읽습니다.
-- 아이디는 따로 표를 두지 않고 app_metadata.login_id 에 둡니다(가상 이메일로 중복을 막음).
--
-- 권한(GRANT)을 직접 적습니다(006 과 같은 이유). 표 이름에 public. 을 붙입니다.
-- 여러 번 실행해도 안전합니다.

-- 1) 넥슨 계정 연결: 우리 계정 1개에 넥슨 계정(API 키) 여러 개. 넥슨 계정 1개는 우리 계정 1개에만.
--    ouid_hash  : 넥슨 계정 고유값(ouid)의 SHA-256. API 키 로그인 때 이 값으로 계정을 찾습니다. 원래 값은 저장하지 않습니다.
--    key_cipher : API 키를 AES-256-GCM 으로 암호화한 값("v1:" 로 시작). 푸는 열쇠는 서버 환경 변수에만 있습니다.
create table if not exists public.nexon_accounts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade, -- 탈퇴하면 같이 지워짐
  ouid_hash text not null unique check (ouid_hash ~ '^[0-9a-f]{64}$'),
  key_cipher text not null check (key_cipher like 'v1:%' and char_length(key_cipher) <= 2000),
  label text check (char_length(label) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nexon_accounts_user_id_idx on public.nexon_accounts (user_id);

alter table public.nexon_accounts enable row level security;

drop policy if exists "Maple members read their own nexon accounts" on public.nexon_accounts;
create policy "Maple members read their own nexon accounts" on public.nexon_accounts
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and (select auth.jwt() -> 'app_metadata' ->> 'app') = 'maple'
  );

-- 로그인 사용자는 본인 행의 "목록에 보일 열"만 읽습니다. 암호화한 키(key_cipher)와 ouid_hash 는
-- 열 권한을 주지 않아 본인 토큰으로도 못 읽습니다. 쓰기(등록 · 교체 · 삭제)는 서버 전용 키만.
revoke all on public.nexon_accounts from anon, authenticated;
grant select (id, user_id, label, created_at, updated_at) on public.nexon_accounts to authenticated;
grant select, insert, update, delete on public.nexon_accounts to service_role;

-- 2) 횟수 세기: 로그인 시도 제한과 넥슨 API 하루 사용량에 같이 씁니다. 읽기 · 쓰기 모두 서버 전용 키만.
--    key 예: 'login:id:<아이디 해시>' · 'login:ip:<IP 해시>' · 'nexon:day:2026-11-11'  (아이디 · IP 원문은 넣지 않음)
create table if not exists public.rate_counters (
  key text primary key check (char_length(key) <= 200),
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

create index if not exists rate_counters_window_start_idx on public.rate_counters (window_start);

alter table public.rate_counters enable row level security;

revoke all on public.rate_counters from anon, authenticated;
grant select, insert, update, delete on public.rate_counters to service_role;

-- 한 번에(원자적으로) 더하고 지금까지의 횟수를 돌려줍니다. 창(p_window_seconds)이 지났으면 새로 셉니다.
-- 동시에 여러 요청이 와도 "읽고 → 더하기" 사이에 끼어들 수 없습니다.
create or replace function public.counter_hit(p_key text, p_window_seconds integer, p_add integer default 1)
returns integer
language sql
set search_path = ''
as $$
  insert into public.rate_counters as c (key, window_start, hits)
  values (p_key, now(), p_add)
  on conflict (key) do update
    set hits = case
          when c.window_start + make_interval(secs => p_window_seconds) <= now() then excluded.hits
          else c.hits + excluded.hits
        end,
        window_start = case
          when c.window_start + make_interval(secs => p_window_seconds) <= now() then now()
          else c.window_start
        end
  returning hits;
$$;

-- public 스키마의 함수는 기본으로 누구나 부를 수 있어(API 로도) 권한을 뺍니다. 서버 전용 키만 호출.
revoke execute on function public.counter_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.counter_hit(text, integer, integer) to service_role;
