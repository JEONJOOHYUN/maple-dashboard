-- 조각 판매(경매장에서 솔 에르다 조각을 팔아 메소로 전환)를 기록하는 테이블.
-- 정산(settlements)은 "보유 메소를 현금화"하는 단계이고,
-- 조각 -> 메소 전환은 이 테이블이 담당합니다.
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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'fragment_sales' and policyname = 'Allow all access to fragment_sales'
  ) then
    create policy "Allow all access to fragment_sales" on fragment_sales
      for all using (true) with check (true);
  end if;
end
$$;

create index if not exists fragment_sales_worker_id_idx on fragment_sales (worker_id);
