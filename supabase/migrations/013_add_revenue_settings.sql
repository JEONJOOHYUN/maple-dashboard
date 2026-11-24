-- 보스 수익 설정(revenue_settings): 회원이 정한 값을 계정에 둬서 다른 기기에서 로그인해도 같게 보입니다.
-- 왜: 지금까지는 브라우저(localStorage)에만 있어, 다른 PC 에서 열면 파티원이 전부 1인으로 돌아갔습니다.
-- 무엇: 파티원 수 · 고른 캐릭터 · 고친 보상 가격 · 경매장 수수료 · 장신망 조각 수익 스위치 · 이번 주 먹은 보상 표시.
-- 기준: 회원(user_id) 한 줄, 안쪽 값은 캐릭터 id(ocid) 기준 → API 키를 다시 받거나 넥슨 계정을 다른 방법으로
--       연결해도 그대로 씁니다. API 키 · 넥슨 계정 줄(nexon_accounts)과는 이어져 있지 않습니다.
-- 누가 쓰나: 서버(app/revenue/actions.ts → lib/revenue/server.ts)만. 바뀐 칸만 받아 합치고(lib/revenue/settings.ts),
--           rev 가 읽을 때와 같을 때만 바꿔 두 기기가 동시에 저장해도 한쪽이 지워지지 않습니다.
-- 읽기 · 쓰기: 정책이 없으므로 서버 전용 키(service role)만 — 회원 본인 토큰으로도 직접 못 읽고, 서버가 회원 id 를
--             조건으로 걸어 읽어 줍니다. 탈퇴하면 같이 지워집니다(on delete cascade).
-- 권한(GRANT)을 직접 적습니다(006 과 같은 이유). 여러 번 실행해도 안전합니다.

create table if not exists public.revenue_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  party jsonb not null default '{}'::jsonb check (jsonb_typeof(party) = 'object' and pg_column_size(party) <= 524288),        -- { "ocid|보스|난이도": 3, "ocid|보스": 3 }
  picked jsonb not null default '[]'::jsonb check (jsonb_typeof(picked) = 'array' and pg_column_size(picked) <= 65536),       -- 고른 캐릭터 ocid
  auto_picked jsonb not null default '[]'::jsonb check (jsonb_typeof(auto_picked) = 'array' and pg_column_size(auto_picked) <= 8192), -- 한 번 자동으로 골라 준 계정
  prices jsonb not null default '{}'::jsonb check (jsonb_typeof(prices) = 'object' and pg_column_size(prices) <= 8192),       -- { "아이템 id": "억 단위로 적은 글자" }
  fee smallint not null default 3 check (fee between 0 and 100),                                                              -- 경매장 수수료 %
  material boolean not null default true,                                                                                    -- 장신망 조각 수익 넣기
  got_week text not null default '' check (char_length(got_week) <= 10),                                                      -- got 이 어느 주 것인지(그 주 목요일 "YYYY-MM-DD")
  got jsonb not null default '{}'::jsonb check (jsonb_typeof(got) = 'object' and pg_column_size(got) <= 524288),              -- 그 주에 먹은 보상 { "ocid|보스|난이도|칸": true 또는 아이템 id }
  rev integer not null default 1,                                                                                            -- 저장할 때마다 +1 (동시 저장 확인)
  updated_at timestamptz not null default now()
);

alter table public.revenue_settings enable row level security;

-- 서버 전용 키에는 Supabase 기본값으로 모든 권한이 붙어 있어 먼저 빼고 필요한 것만 줍니다(지우기 = 탈퇴의 cascade 만).
revoke all on public.revenue_settings from anon, authenticated, service_role;
grant select, insert, update on public.revenue_settings to service_role;
