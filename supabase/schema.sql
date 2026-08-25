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

-- 정산(경매장 판매) 내역. 정산할 때마다 그 시점의 시세와 정산된 수량을
-- 한 행으로 기록해두고, 누적 현황은 hunting_logs 합계에서 이 합계를 뺀
-- "미정산 잔액"으로 계산합니다. 일일 기록 자체는 지우지 않아 달력에는
-- 계속 남습니다.
create table if not exists settlements (
  id bigint generated always as identity primary key,
  worker_id bigint not null references workers(id) on delete cascade,
  settled_at timestamptz not null default now(),
  fragment_price bigint not null,
  cash_rate bigint not null,
  fragment_count bigint not null,
  pure_meso bigint not null,
  fee_meso bigint not null,
  total_meso bigint not null,
  krw_value bigint not null
);

alter table settlements enable row level security;

create policy "Allow all access to settlements"
  on settlements
  for all
  using (true)
  with check (true);
