-- 개편 전 부주 정산 · 관리자(/admin) 앱이 쓰던 표를 지웁니다.
-- 2026-11-08 사용자 결정: 옛 데이터는 옮기지 않고 새로 시작, 옛 관리자 방식은 통째로 없앰.
-- 백업: C:\dev\_backup\maple-db-2026-11-08\*.json (git 밖, 5개 표 행 수 전체와 일치).
--
-- 실행 시점: 새 코드(redesign)가 운영(main)에 배포된 뒤. 그 전에 실행하면 지금 운영 사이트의 옛 화면이 깨집니다.
-- 여러 번 실행해도 됩니다(if exists). cascade 를 쓰지 않아, 예상 못 한 곳이 이 표를 참조하면 멈추고 아무것도 지우지 않습니다.
-- 건드리지 않는 것: sunday_weeks · sunday_cron_runs · nexon_accounts · rate_counters, nyamnyam 스키마.

begin;

-- 자식 표부터 (worker_id 가 workers 를 참조).
drop table if exists public.log_entries;
drop table if exists public.settlements;
drop table if exists public.fragment_sales;
drop table if exists public.hunting_logs;  -- 트리거 hunting_logs_audit 도 같이 지워짐
drop table if exists public.workers;

-- hunting_logs 트리거가 쓰던 함수.
drop function if exists public.record_hunting_log_entry();

commit;
