-- ============================================================
-- 지원사업 공고 모니터링 (Feature 3)
--
-- 목적:
--   - 기업마당 '창업' 대분류 + 서울/전국 공고 스냅샷 저장
--   - external_id UNIQUE 로 중복 방지
--   - subsidy_fetch_log.fetch_date PK 로 하루 1회 동기화 멱등성 확보
--   - law_chunks 임베딩 동기화 추적(embedded_at)
-- ============================================================

create table if not exists subsidy_programs (
  id              bigserial primary key,
  external_id     text unique not null,          -- bizinfo pblancId
  title           text not null,
  organization    text,
  region          text,                          -- '마포구' | '서울' | '전국'
  program_kind    text,                          -- pldirSportRealmLclasCodeNm (대분류)
  sub_kind        text,                          -- pldirSportRealmMlsfcCodeNm (중분류)
  target          text,                          -- trgetNm
  start_date      date,
  end_date        date,
  period_raw      text,                          -- "예산 소진시까지" 등 원문 보존
  is_ongoing      boolean not null default false,-- 기간 파싱 실패 = 상시 모집
  description     text,
  detail_url      text,
  external_url    text,
  hashtags        text,
  raw             jsonb,
  fetched_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  embedded_at     timestamptz                     -- law_chunks 임베딩 완료 시각
);

create index if not exists subsidy_programs_period_idx
  on subsidy_programs (start_date, end_date);

create index if not exists subsidy_programs_region_idx
  on subsidy_programs (region);

create index if not exists subsidy_programs_kind_idx
  on subsidy_programs (program_kind);

create index if not exists subsidy_programs_ongoing_idx
  on subsidy_programs (is_ongoing);

create index if not exists subsidy_programs_embedded_idx
  on subsidy_programs (embedded_at);

-- 일일 동기화 로그
create table if not exists subsidy_fetch_log (
  fetch_date     date primary key,
  fetched_count  int not null default 0,
  fetched_at     timestamptz not null default now()
);

-- RLS: 공고는 로그인/익명 모두 읽기 허용, 쓰기는 service_role 만
alter table subsidy_programs enable row level security;
alter table subsidy_fetch_log enable row level security;

drop policy if exists "subsidy_programs_read" on subsidy_programs;
create policy "subsidy_programs_read" on subsidy_programs
  for select using (true);

drop policy if exists "subsidy_fetch_log_read" on subsidy_fetch_log;
create policy "subsidy_fetch_log_read" on subsidy_fetch_log
  for select using (true);
