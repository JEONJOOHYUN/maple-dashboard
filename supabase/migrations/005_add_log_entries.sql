-- 일일 사냥 기록의 변경 내역(입력 이력)을 남깁니다.
--
-- hunting_logs는 날짜당 한 행만 두고 값을 더하거나 덮어쓰기 때문에,
-- "언제 얼마를 더했는지"가 남지 않습니다. 트리거로 변경분(delta)을 기록해
-- 앱/관리자 페이지/SQL 어디서 바꾸든 모두 이력에 남도록 합니다.

create table if not exists log_entries (
  id bigint generated always as identity primary key,
  worker_id bigint not null references workers(id) on delete cascade,
  log_date date not null,
  delta_pure_meso bigint not null,
  delta_fragment_count integer not null,
  operation text not null, -- insert | update | delete
  created_at timestamptz not null default now()
);

create index if not exists log_entries_worker_created_idx
  on log_entries (worker_id, created_at desc);

alter table log_entries enable row level security;

drop policy if exists "Allow all access to log_entries" on log_entries;
create policy "Allow all access to log_entries" on log_entries
  for all using (true) with check (true);

create or replace function record_hunting_log_entry()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    insert into log_entries (worker_id, log_date, delta_pure_meso, delta_fragment_count, operation)
    values (new.worker_id, new.log_date, new.pure_meso, new.fragment_count, 'insert');
    return new;

  elsif (tg_op = 'UPDATE') then
    -- updated_at만 바뀐 경우처럼 실제 값 변화가 없으면 기록하지 않습니다.
    if (new.pure_meso is distinct from old.pure_meso
        or new.fragment_count is distinct from old.fragment_count
        or new.log_date is distinct from old.log_date) then
      insert into log_entries (worker_id, log_date, delta_pure_meso, delta_fragment_count, operation)
      values (
        new.worker_id,
        new.log_date,
        new.pure_meso - old.pure_meso,
        new.fragment_count - old.fragment_count,
        'update'
      );
    end if;
    return new;

  else
    -- 부주를 삭제하면 hunting_logs가 cascade로 지워지는데, 이때는 참조할 부주가
    -- 이미 없으므로 이력을 남기지 않습니다 (외래키 위반 방지).
    if exists (select 1 from workers where id = old.worker_id) then
      insert into log_entries (worker_id, log_date, delta_pure_meso, delta_fragment_count, operation)
      values (old.worker_id, old.log_date, -old.pure_meso, -old.fragment_count, 'delete');
    end if;
    return old;
  end if;
end;
$$;

drop trigger if exists hunting_logs_audit on hunting_logs;
create trigger hunting_logs_audit
  after insert or update or delete on hunting_logs
  for each row execute function record_hunting_log_entry();
