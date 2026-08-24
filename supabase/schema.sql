-- 부주 사냥 수익 정산 대시보드: 일일 사냥 기록 테이블
create table if not exists hunting_logs (
  id bigint generated always as identity primary key,
  log_date date not null unique,
  pure_meso bigint not null default 0,
  fragment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 개인용 도구이며 별도 로그인 기능이 없으므로, anon key로 전체 접근을 허용합니다.
-- 공개 배포 시 데이터 노출이 우려되면 Vercel 배포 보호 기능 등을 함께 사용하세요.
alter table hunting_logs enable row level security;

create policy "Allow all access to hunting_logs"
  on hunting_logs
  for all
  using (true)
  with check (true);
