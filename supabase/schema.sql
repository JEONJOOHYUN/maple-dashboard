-- 부주(캐릭터/사람) 목록. 상단 탭에서 승환, 양우처럼 여러 명을 추가하고
-- 전환할 수 있습니다. 각 부주의 기록/정산은 worker_id로 구분됩니다.
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

-- 부주 사냥 수익 정산 대시보드: 일일 사냥 기록 테이블
create table if not exists hunting_logs (
  id bigint generated always as identity primary key,
  worker_id bigint not null references workers(id) on delete cascade,
  log_date date not null,
  pure_meso bigint not null default 0,
  fragment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (worker_id, log_date)
);

-- 개인용 도구이며 별도 로그인 기능이 없으므로, anon key로 전체 접근을 허용합니다.
-- 공개 배포 시 데이터 노출이 우려되면 Vercel 배포 보호 기능 등을 함께 사용하세요.
alter table hunting_logs enable row level security;

create policy "Allow all access to hunting_logs"
  on hunting_logs
  for all
  using (true)
  with check (true);

-- 조각 판매 내역. 경매장에서 솔 에르다 조각을 팔아 메소로 전환한 기록이며,
-- 판매한 조각 수만큼 누적 조각에서 빠지고 실수령 메소(net_meso)만큼
-- 누적 순수 메소가 늘어납니다. 현금화(정산)와는 별개 단계입니다.
create table if not exists fragment_sales (
  id bigint generated always as identity primary key,
  worker_id bigint not null references workers(id) on delete cascade,
  sold_at timestamptz not null default now(),
  fragment_count integer not null,
  fragment_price bigint not null,
  gross_meso bigint not null,
  fee_meso bigint not null,
  net_meso bigint not null
);

alter table fragment_sales enable row level security;

create policy "Allow all access to fragment_sales"
  on fragment_sales
  for all
  using (true)
  with check (true);

create index if not exists fragment_sales_worker_id_idx on fragment_sales (worker_id);

-- 정산(현금화) 내역. 보유 메소를 현금으로 정산할 때마다 그 시점의 시세와
-- 정산된 메소를 한 행으로 기록해두고, 누적 현황은 hunting_logs 합계에서
-- 이 합계를 뺀 "미정산 잔액"으로 계산합니다. 일일 기록 자체는 지우지 않아
-- 달력에는 계속 남습니다.
-- fragment_count/fee_meso는 조각 판매가 분리되기 전(2026-09 이전) 정산 행의
-- 호환을 위해 남아 있으며, 새 정산은 0으로 기록됩니다.
create table if not exists settlements (
  id bigint generated always as identity primary key,
  worker_id bigint not null references workers(id) on delete cascade,
  settled_at timestamptz not null default now(),
  fragment_price bigint not null,
  cash_rate bigint not null,
  fragment_count bigint not null,
  pure_meso bigint not null,
  fee_meso bigint not null,
  incentive_meso bigint not null default 0,
  total_meso bigint not null,
  krw_value bigint not null
);

alter table settlements enable row level security;

create policy "Allow all access to settlements"
  on settlements
  for all
  using (true)
  with check (true);

-- 일일 사냥 기록의 변경 내역. hunting_logs는 날짜당 한 행에 값을 더하거나
-- 덮어쓰기 때문에 "언제 얼마를 더했는지"가 남지 않아, 트리거로 변경분을
-- 따로 기록합니다. (앱/관리자 페이지/SQL 어디서 바꾸든 모두 남습니다)
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

create policy "Allow all access to log_entries"
  on log_entries
  for all
  using (true)
  with check (true);

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
