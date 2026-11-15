-- 썬데이 예측 기록(sunday_predictions): 화면에 보인 "다음 썬데이 예측"을 공지 전에 그대로 남깁니다.
-- 왜: 지금까지 적중률은 지난 기록으로 다시 계산한 값(백테스트)뿐입니다. 실제로 공지 전에 보여 준 예측은
-- 지나가면 다시 만들 수 없어서, 적중 기록과 모델 비교에 쓰려고 남깁니다.
-- 누가 쓰나: Cron(app/api/cron/sunday)이 돌 때마다 화면과 같은 일요일의 예측을 계산해 넣습니다(lib/sunday/prediction-log.ts).
-- (sunday, model) 한 줄: 같은 모델의 첫 기록만 남고 덮어쓰지 않습니다. 모델을 바꾸면(predict.ts MODEL_VERSION) 새 줄이 생깁니다.
-- 읽기: 누구나(이미 화면에 보인 값). 쓰기: 정책이 없으므로 서버 전용 키(service role)만, 그것도 넣기만(고치기 · 지우기 없음).
-- 권한(GRANT)을 직접 적습니다: 006 과 같은 이유(Supabase 는 public 의 새 표에 권한을 자동으로 주지 않음).
-- 여러 번 실행해도 안전합니다.

create table if not exists public.sunday_predictions (
  sunday date not null,                        -- 예측한 일요일
  model text not null,                         -- 모델 버전(lib/sunday/predict.ts MODEL_VERSION)
  picks jsonb not null,                        -- 화면의 5개, 화면 순서 [{ "id": "monster-park", "p": 0.275 }]
  ranked jsonb not null,                       -- 모든 묶음의 확률(나중에 확률이 얼마나 맞았는지 계산)
  themes jsonb not null,                       -- { "starforce": 0.21, "enhance": 0.47, "hunt": 0.57 }
  big_days jsonb not null default '{}'::jsonb, -- 큰 날 예상 { "miracle": { "last": "2026-09-27", "minWeeks": 8, "maxWeeks": 10 } }
  data_end date not null,                      -- 예측에 쓴 마지막 기록 주
  missing_weeks integer not null default 0,    -- 마지막 기록과 예측한 일요일 사이에 빠진 주
  recorded_at timestamptz not null default now(),
  primary key (sunday, model)
);

alter table public.sunday_predictions enable row level security;

drop policy if exists "Anyone can read sunday predictions" on public.sunday_predictions;
create policy "Anyone can read sunday predictions" on public.sunday_predictions
  for select to anon, authenticated using (true);

-- 서버 전용 키에는 Supabase 기본값으로 모든 권한이 붙어 있어(2026-11-15 확인) 먼저 빼고 읽기 · 넣기만 줍니다.
-- 잘못 들어간 줄은 SQL 편집기(postgres)에서 지웁니다.
revoke all on public.sunday_predictions from anon, authenticated, service_role;
grant select on public.sunday_predictions to anon, authenticated;
grant select, insert on public.sunday_predictions to service_role;
