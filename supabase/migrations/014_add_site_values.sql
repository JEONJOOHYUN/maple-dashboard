-- 사이트 기본값(site_values) · 고친 기록(site_value_changes) · 관리자(site_admins).
-- 왜: 보스 결정석 · 아이템 노작값 · 큐브 · 캐시 아이템 · 메소 시세는 패치와 시세에 따라 바뀌는데, 지금까지는
--     코드를 고쳐 배포해야 했습니다. 관리자 화면(/admin)에서 고치면 다음 방문부터 모든 화면에 반영됩니다.
-- 무엇: site_values 에는 **코드 기본값과 다른 칸만** 들어갑니다(줄이 없으면 코드 값). 확률 · 게임 규칙은 없습니다.
--   · key 예: "crystal|림보|익스트림"(메소) · "spare|sin"(억) · "reward|rr4"(만) · "mvp|pga|auction"(억)
--             "credit|prime|credit" · "market|mesoWon" · "extra|<아이템 이름>"({level, icon, spareEok})
--   · 어떤 key 가 있고 값이 어떤 모양인지는 서버가 검사합니다(lib/site-values/values.ts cleanValue).
-- 누가 쓰나: 서버(app/admin/actions.ts → lib/site-values/server.ts)만, 관리자 표에 있는 회원이 반영할 때.
--   · site_values_apply() 가 칸마다 "읽었을 때 값 그대로일 때만" 바꾸고 기록 한 줄을 같이 남깁니다(한 트랜잭션).
--     두 관리자가 같은 칸을 고치면 늦은 쪽이 거절됩니다("stale").
-- 읽기: site_values 는 누구나(화면이 기본값으로 읽음). 기록 · 관리자 표는 정책이 없어 서버 전용 키만.
-- 관리자 넣기: 첫 관리자는 SQL 로 한 번 넣습니다(회원 id 는 저장소에 적지 않습니다).
--   insert into public.site_admins (user_id, role, name) values ('<auth.users 의 id>', 'owner', '<기록에 남을 이름>');
-- 권한(GRANT)을 직접 적습니다(006 과 같은 이유). 표 이름에 public. 을 붙입니다(같은 프로젝트의 다른 스키마 때문).
-- 여러 번 실행해도 안전합니다.

create table if not exists public.site_values (
  key text primary key check (char_length(key) between 3 and 120),
  value jsonb not null check (jsonb_typeof(value) in ('number', 'object') and pg_column_size(value) <= 1024),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.site_values enable row level security;

drop policy if exists "Anyone can read the site values" on public.site_values;
create policy "Anyone can read the site values" on public.site_values
  for select to anon, authenticated using (true);

-- 서버 전용 키에는 Supabase 기본값으로 모든 권한이 붙어 있어 먼저 빼고 필요한 것만 줍니다.
revoke all on public.site_values from anon, authenticated, service_role;
grant select (key, value) on public.site_values to anon, authenticated;
grant select, insert, update, delete on public.site_values to service_role;

create table if not exists public.site_value_changes (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  by uuid references auth.users (id) on delete set null,
  by_name text not null default '' check (char_length(by_name) <= 40),                                    -- 고친 때의 관리자 이름(나중에 관리자에서 빠져도 기록은 남음)
  note text not null default '' check (char_length(note) <= 200),                                         -- 왜 고쳤는지(안 적어도 됨)
  changes jsonb not null check (jsonb_typeof(changes) = 'array' and pg_column_size(changes) <= 262144)   -- [{ "key", "from", "to" }] — 코드 값이었으면 그 값, 뺀 아이템은 null
);

alter table public.site_value_changes enable row level security;
revoke all on public.site_value_changes from anon, authenticated, service_role;
grant select, insert on public.site_value_changes to service_role;

create index if not exists site_value_changes_at on public.site_value_changes (at desc);

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  name text not null default '' check (char_length(name) <= 40),
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.site_admins enable row level security;
-- 읽기만: 관리자를 넣고 빼는 화면은 아직 없습니다(위의 SQL 로 넣음). 그 화면을 만들 때 쓰기 권한을 더합니다.
revoke all on public.site_admins from anon, authenticated, service_role;
grant select on public.site_admins to service_role;

-- 한 번에 반영: p_changes = [{ "key", "was", "set", "from", "to" }]
--   was = 읽었을 때 그 칸의 줄(null = 줄 없음 = 코드 값), set = 새로 둘 값(null = 줄을 지움 = 코드 값으로),
--   from · to = 기록에 남길 값(화면에 보이던 값).
-- 돌려주는 값: 'ok' · 'stale'(그 사이에 다른 반영이 그 칸을 바꿈 — 아무것도 안 바뀜).
create or replace function public.site_values_apply(p_by uuid, p_name text, p_note text, p_changes jsonb)
returns text
language plpgsql
set search_path = ''
as $$
declare
  c jsonb;
  cur jsonb;
begin
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) = 0 then
    return 'stale';
  end if;
  -- 반영은 한 번에 하나씩: 확인과 쓰기 사이에 다른 반영이 끼어들지 못합니다.
  perform pg_advisory_xact_lock(hashtext('public.site_values_apply'));

  for c in select * from jsonb_array_elements(p_changes) loop
    select value into cur from public.site_values where key = c ->> 'key';
    if not found then
      cur := null;
    end if;
    if cur is distinct from nullif(c -> 'was', 'null'::jsonb) then
      return 'stale';
    end if;
  end loop;

  for c in select * from jsonb_array_elements(p_changes) loop
    if nullif(c -> 'set', 'null'::jsonb) is null then
      delete from public.site_values where key = c ->> 'key';
    else
      insert into public.site_values (key, value, updated_at, updated_by)
      values (c ->> 'key', c -> 'set', now(), p_by)
      on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
    end if;
  end loop;

  insert into public.site_value_changes (by, by_name, note, changes)
  select p_by, left(coalesce(p_name, ''), 40), left(coalesce(p_note, ''), 200),
         jsonb_agg(jsonb_build_object('key', e ->> 'key', 'from', e -> 'from', 'to', e -> 'to'))
  from jsonb_array_elements(p_changes) as e;

  return 'ok';
end;
$$;

revoke all on function public.site_values_apply(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.site_values_apply(uuid, text, text, jsonb) to service_role;
