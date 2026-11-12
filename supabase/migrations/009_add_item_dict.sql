-- 공용 아이템 사전(item_dict): 아이템 이름 → 장비 레벨 · 아이콘 코드 · 부위.
-- 강화 기록(/enhance)을 쓰는 사람들의 브라우저가 넥슨 Open API 에서 알아낸 것을 모아, 모두가 같이 씁니다.
--   · 그림: 넥슨 기록에는 아이템 이름만 있고, 그림은 "지금 낀 장비"에서만 알 수 있어 벗거나 판 장비는 그림이 없음
--   · 레벨: 스타포스 기록에는 레벨이 없어, 모르면 손익 계산에서 빠짐
-- 담는 것은 아이템 사실뿐입니다. 캐릭터 이름 · API 키 · 강화 기록은 들어오지 않습니다.
-- 아이콘은 넥슨 주소(https://open.api.nexon.com/static/maplestory/item/icon/<코드>)의 코드만 둡니다(그림 파일은 안 둠).
--
-- 읽기: 누구나. 쓰기: 정책이 없으므로 서버 전용 키(service role)만 — 서버 액션이 값을 검사한 뒤 넣습니다.
-- 먼저 들어온 레벨을 유지합니다(뒤에 온 값은 비어 있는 아이콘 · 부위만 채움).
-- 권한(GRANT)을 직접 적습니다: Supabase 는 2026-10-30 부터 public 의 새 표에 권한을 자동으로 주지 않습니다.
-- 표 이름에 public. 을 붙여, 같은 프로젝트의 다른 스키마(nyamnyam)에 만들어질 일이 없게 합니다.
-- 호출 횟수 제한은 007 의 public.counter_hit() 을 같이 씁니다.
-- 여러 번 실행해도 안전합니다.

create table if not exists public.item_dict (
  name text primary key check (char_length(name) between 1 and 60),
  level integer not null check (level between 1 and 300),
  icon text not null default '' check (icon ~ '^[A-Za-z0-9]{0,40}$'),
  part text not null default '' check (char_length(part) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.item_dict enable row level security;

drop policy if exists "Anyone can read the item dictionary" on public.item_dict;
create policy "Anyone can read the item dictionary" on public.item_dict
  for select to anon, authenticated using (true);

revoke all on public.item_dict from anon, authenticated;
grant select on public.item_dict to anon, authenticated;
grant select, insert, update, delete on public.item_dict to service_role;
