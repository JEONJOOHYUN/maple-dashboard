-- 정산 시 부주에게 추가로 지급하는 인센티브 메소를 기록하기 위한 컬럼입니다.
-- Supabase SQL Editor에서 한 번만 실행하세요.
alter table settlements add column if not exists incentive_meso bigint not null default 0;
