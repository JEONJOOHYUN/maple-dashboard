-- 공용 아이템 사전(item_dict)을 관리자가 고칠 수 있게: 노작값 · 막음 · 확인 표시.
-- 왜: 사전은 방문자 브라우저가 올린 것(이름 · 레벨 · 그림 · 부위)이라 틀린 줄이 생길 수 있는데, 지금까지는
--     ① 지워도 다음 사람이 같은 이름을 보내면 다시 들어오고 ② 처음 들어온 레벨이 계속 남아 고칠 길이 없었습니다.
--     관리자가 넣은 노작값도 레벨 · 그림을 복사해 다른 표(site_values 의 "extra|이름")에 따로 두고 있었습니다.
-- 무엇(열 추가):
--   · spare_eok  노작값(억 메소). null = 값 없음(강화 기록은 0 으로 봄). 값이 있으면 기댓값 계산기 목록에도 나옵니다.
--   · blocked    막은 이름. 줄은 남겨 둡니다 → 다시 올라오지 못하고(이미 있는 이름), 화면에도 안 나갑니다(읽기 정책).
--   · checked_at · checked_by  관리자가 보거나 고친 줄("아직 안 본 줄"을 골라 보려고).
-- 방문자 보고는 그대로: 없는 이름만 새로 넣고, 비어 있는 그림 · 부위만 채웁니다(막은 줄은 건드리지 않음 — 서버 코드).
-- 읽기: 누구나, 막지 않은 줄의 이름 · 레벨 · 그림 · 부위 · 노작값만. 쓰기: 서버 전용 키만(관리자 화면이 아래 함수로).
-- site_values_apply() 를 다시 만듭니다(인자는 그대로): "dict|<이름>" 으로 시작하는 key 는 이 표의 한 줄입니다.
--   · { "key": "dict|이름", "was": {줄} 또는 null, "set": {줄}, "from", "to" }  줄 = { level, part, icon, spareEok, blocked }
--     읽었을 때 그대로일 때만 바꿉니다(was = null 이면 없는 이름을 새로 넣음). 바꾼 줄은 확인 표시가 붙습니다.
--   · { "key": "dict|이름", "check": true }  고치지 않고 확인 표시만(기록에는 안 남김)
--   · 그 밖의 key 는 014 와 같습니다(site_values).
--   방문자 보고(서버 코드가 따로 씀)와 겹쳐도 덮어쓰지 않습니다: 비교한 줄은 끝날 때까지 잠그고(for update),
--   없던 이름을 넣으려는데 그사이 생겼으면 'stale' 오류로 전부 되돌립니다.
-- 옮기기: 014 때 "extra|이름" 으로 넣어 둔 가격이 있으면 이 표의 spare_eok 로 옮기고 그 줄을 지웁니다.
-- 여러 번 실행해도 안전합니다.

alter table public.item_dict
  add column if not exists spare_eok numeric check (spare_eok is null or (spare_eok >= 0 and spare_eok <= 1000000)),
  add column if not exists blocked boolean not null default false,
  add column if not exists checked_at timestamptz,
  add column if not exists checked_by uuid references auth.users (id) on delete set null;

drop policy if exists "Anyone can read the item dictionary" on public.item_dict;
create policy "Anyone can read the item dictionary" on public.item_dict
  for select to anon, authenticated using (not blocked);

revoke all on public.item_dict from anon, authenticated;
grant select (name, level, icon, part, spare_eok) on public.item_dict to anon, authenticated;

-- 014 방식으로 넣어 둔 가격 옮기기(없으면 아무 일도 없음). 사전에 없는 이름이면 그 값의 레벨 · 그림으로 줄을 만듭니다.
insert into public.item_dict (name, level, icon, part, spare_eok, checked_at)
select substr(v.key, 7), (v.value ->> 'level')::integer, coalesce(v.value ->> 'icon', ''), '', (v.value ->> 'spareEok')::numeric, now()
from public.site_values v
where v.key like 'extra|%' and jsonb_typeof(v.value) = 'object' and (v.value ->> 'spareEok') is not null
on conflict (name) do update set spare_eok = excluded.spare_eok, checked_at = excluded.checked_at;
delete from public.site_values where key like 'extra|%';

create or replace function public.site_values_apply(p_by uuid, p_name text, p_note text, p_changes jsonb)
returns text
language plpgsql
set search_path = ''
as $$
declare
  c jsonb;
  cur jsonb;
  k text;
  item text;
  s jsonb;
  logged jsonb;
begin
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) = 0 then
    return 'stale';
  end if;
  -- 반영은 한 번에 하나씩: 확인과 쓰기 사이에 다른 반영이 끼어들지 못합니다.
  perform pg_advisory_xact_lock(hashtext('public.site_values_apply'));

  for c in select * from jsonb_array_elements(p_changes) loop
    k := c ->> 'key';
    if c ? 'check' then
      continue;
    end if;
    cur := null;
    if k like 'dict|%' then
      -- 잠가 둡니다: 방문자 보고가 이 줄의 빈 그림 · 부위를 채우려면 이 반영이 끝날 때까지 기다립니다.
      select jsonb_build_object('level', d.level, 'part', d.part, 'icon', d.icon, 'spareEok', d.spare_eok, 'blocked', d.blocked)
        into cur from public.item_dict d where d.name = substr(k, 6) for update;
    else
      select v.value into cur from public.site_values v where v.key = k;
    end if;
    if cur is distinct from nullif(c -> 'was', 'null'::jsonb) then
      return 'stale';
    end if;
  end loop;

  for c in select * from jsonb_array_elements(p_changes) loop
    k := c ->> 'key';
    s := nullif(c -> 'set', 'null'::jsonb);
    if k like 'dict|%' then
      item := substr(k, 6);
      if c ? 'check' then
        update public.item_dict set checked_at = now(), checked_by = p_by where name = item and checked_at is null;
      elsif s is not null and nullif(c -> 'was', 'null'::jsonb) is null then
        -- 없던 이름: 그사이 방문자 보고로 생겼으면 덮지 않고 전부 되돌립니다.
        insert into public.item_dict (name, level, icon, part, spare_eok, blocked, checked_at, checked_by, updated_at)
        values (item, (s ->> 'level')::integer, s ->> 'icon', s ->> 'part', (s ->> 'spareEok')::numeric, (s ->> 'blocked')::boolean, now(), p_by, now())
        on conflict (name) do nothing;
        if not found then
          raise exception 'stale';
        end if;
      elsif s is not null then
        update public.item_dict set level = (s ->> 'level')::integer, icon = s ->> 'icon', part = s ->> 'part', spare_eok = (s ->> 'spareEok')::numeric,
          blocked = (s ->> 'blocked')::boolean, checked_at = now(), checked_by = p_by, updated_at = now()
        where name = item;
      end if;
    elsif s is null then
      delete from public.site_values where key = k;
    else
      insert into public.site_values (key, value, updated_at, updated_by)
      values (k, s, now(), p_by)
      on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
    end if;
  end loop;

  select jsonb_agg(jsonb_build_object('key', e ->> 'key', 'from', e -> 'from', 'to', e -> 'to'))
    into logged from jsonb_array_elements(p_changes) as e where not (e ? 'check');
  if logged is not null then
    insert into public.site_value_changes (by, by_name, note, changes)
    values (p_by, left(coalesce(p_name, ''), 40), left(coalesce(p_note, ''), 200), logged);
  end if;

  return 'ok';
end;
$$;

revoke all on function public.site_values_apply(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.site_values_apply(uuid, text, text, jsonb) to service_role;
