-- 썬데이 기초 모델 점수(sunday_ml_scores): 매주 GitHub Actions 가 계산한 "다음 일요일에 각 묶음이 나올 확률"을 둡니다.
-- 왜: 화면 예측은 통계 모델과 이 점수를 반반 섞습니다(lib/sunday/ml.ts). 모델(TabICL)은 Python 이라 Vercel 밖에서 돌립니다.
-- 누가 쓰나: GitHub Actions(.github/workflows/sunday-ml.yml)가 app/api/sunday/ml 로 보내고, 그 경로가 서버 전용 키(service role)로 넣습니다.
-- (sunday, model) 한 줄: 같은 일요일을 다시 계산하면 바꿔 씁니다(기록이 늦게 들어온 뒤 다시 계산할 수 있음).
-- 화면은 data_hash(계산에 쓴 기록 전체의 지문)가 지금 기록과 맞을 때만 씁니다. 마지막 주만 보면 빠졌던 주가 나중에
-- 채워지거나 지난 주가 고쳐진 것을 모릅니다(Codex 리뷰 2026-11-15).
-- 읽기: 누구나(화면에 섞여 보이는 값). 쓰기: 서버 전용 키만, 넣기 · 바꾸기만(지우기 없음).
-- 권한(GRANT)을 직접 적습니다: 006 · 010 과 같은 이유(Supabase 는 public 의 새 표에 권한을 자동으로 주지 않음).
-- 여러 번 실행해도 안전합니다.

create table if not exists public.sunday_ml_scores (
  sunday date not null,                         -- 예측한 일요일
  model text not null,                          -- 모델 버전(lib/sunday/ml.ts ML_MODEL)
  data_end date not null,                       -- 계산에 쓴 마지막 기록 주(읽기 쉬우라고, 비교는 data_hash 로)
  data_hash text not null,                      -- 계산에 쓴 기록 전체의 지문(lib/sunday/ml.ts mlDataHash)
  scores jsonb not null,                        -- { "monster-park": 0.31, "shining": 0.12, ... }
  computed_at timestamptz not null default now(),
  primary key (sunday, model)
);

alter table public.sunday_ml_scores enable row level security;

drop policy if exists "Anyone can read sunday ml scores" on public.sunday_ml_scores;
create policy "Anyone can read sunday ml scores" on public.sunday_ml_scores
  for select to anon, authenticated using (true);

-- 서버 전용 키에는 Supabase 기본값으로 모든 권한이 붙어 있어 먼저 빼고 읽기 · 넣기 · 바꾸기만 줍니다.
revoke all on public.sunday_ml_scores from anon, authenticated, service_role;
grant select on public.sunday_ml_scores to anon, authenticated;
grant select, insert, update on public.sunday_ml_scores to service_role;
