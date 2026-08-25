-- 이미 hunting_logs / settlements가 있는 기존 프로젝트에 부주(워커) 개념을
-- 추가하는 마이그레이션입니다. Supabase SQL Editor에서 한 번만 실행하세요.

create table if not exists workers (
  id bigint generated always as identity primary key,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table workers enable row level security;

create policy "Allow all access to workers"
  on workers
  for all
  using (true)
  with check (true);

alter table hunting_logs add column if not exists worker_id bigint references workers(id) on delete cascade;
alter table settlements add column if not exists worker_id bigint references workers(id) on delete cascade;

-- 기존에 쌓인 데이터는 모두 승환의 기록이므로 "승환" 부주를 만들고 몰아둡니다.
-- 다른 부주(예: 양우)는 이 마이그레이션 실행 후 화면 상단 탭이나 관리자
-- 페이지에서 직접 추가하면 됩니다.
insert into workers (name, sort_order)
select '승환', 0
where not exists (select 1 from workers);

update hunting_logs set worker_id = (select id from workers order by id limit 1) where worker_id is null;
update settlements set worker_id = (select id from workers order by id limit 1) where worker_id is null;

alter table hunting_logs alter column worker_id set not null;
alter table settlements alter column worker_id set not null;

-- log_date는 이제 부주별로만 유일하면 됩니다.
alter table hunting_logs drop constraint if exists hunting_logs_log_date_key;
alter table hunting_logs add constraint hunting_logs_worker_id_log_date_key unique (worker_id, log_date);
