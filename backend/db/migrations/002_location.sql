-- ============================================================
-- BOSS DB 마이그레이션 002: 입지분석 테이블
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 상권별 분석 결과 캐시 (TTL 7일 — 앱 레이어에서 체크)
create table if not exists location_reports (
  id            bigserial primary key,
  district_name text not null,
  scores        jsonb not null,   -- { saturation, revenue, bep_months, survival, growth, total }
  risk_level    text not null check (risk_level in ('LOW','MED','HIGH')),
  llm_report    text,             -- Claude 해석 텍스트
  raw_data      jsonb,            -- 원본 데이터 스냅샷 (alley + seoul_open 합본)
  created_at    timestamptz default now(),
  unique (district_name)
);

-- 창업자별 입지 검색 이력
create table if not exists founder_location_searches (
  id            bigserial primary key,
  user_id       uuid references users(id) on delete cascade,
  districts     text[]   not null,   -- 비교 요청 상권 목록
  top_pick      text,                -- 종합 1위 상권명
  report_ids    bigint[] not null,   -- location_reports.id FK 배열
  searched_at   timestamptz default now()
);

-- 인덱스
create index if not exists idx_location_reports_district
  on location_reports (district_name);

create index if not exists idx_founder_loc_searches_user
  on founder_location_searches (user_id);

-- ============================================================
-- RLS
-- ============================================================

-- location_reports: 인증된 사용자 누구나 읽기 가능 (상권 정보는 공통)
alter table location_reports enable row level security;

create policy "location_reports_read_all" on location_reports
  for select using (auth.role() = 'authenticated');

-- founder_location_searches: 본인 이력만 접근
alter table founder_location_searches enable row level security;

create policy "founder_loc_searches_own" on founder_location_searches
  for all using (auth.uid() = user_id);
