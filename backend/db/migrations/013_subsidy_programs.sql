-- ============================================================
-- 지원사업 공고 모니터링 (Feature 3)
--
-- 목적:
--   - 기업마당 공고를 최근 3년치 백필 + 매일 증분 수집해 캘린더에 노출
--   - external_id UNIQUE 로 중복 저장 방지
--   - subsidy_fetch_log.fetch_date PK 로 하루 1회 동기화 멱등성 확보
-- ============================================================

-- 1. 공고 저장 테이블
create table if not exists subsidy_programs (
  id              bigserial primary key,
  external_id     text unique not null,          -- bizinfo pblancId
  title           text not null,
  organization    text,
  region          text,                          -- '마포구' / '서울' / '전국'
  business_type   text,                          -- 'cafe' / 'bakery' / 'snack' / null=전체
  start_date      date,
  end_date        date,
  description     text,
  detail_url      text,
  raw             jsonb,
  fetched_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists subsidy_programs_period_idx
  on subsidy_programs (start_date, end_date);

create index if not exists subsidy_programs_region_biz_idx
  on subsidy_programs (region, business_type);

create index if not exists subsidy_programs_end_date_idx
  on subsidy_programs (end_date desc);

-- 2. 일일 동기화 로그 (멱등성)
create table if not exists subsidy_fetch_log (
  fetch_date     date primary key,
  fetched_count  int not null default 0,
  fetched_at     timestamptz not null default now()
);

-- 3. RLS — 공고는 모든 로그인 사용자가 읽기 가능, 쓰기는 service_role 만
alter table subsidy_programs enable row level security;
alter table subsidy_fetch_log enable row level security;

drop policy if exists "subsidy_programs_read" on subsidy_programs;
create policy "subsidy_programs_read" on subsidy_programs
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "subsidy_fetch_log_read" on subsidy_fetch_log;
create policy "subsidy_fetch_log_read" on subsidy_fetch_log
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
