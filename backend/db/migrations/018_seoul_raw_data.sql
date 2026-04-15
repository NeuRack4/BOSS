-- 서울 전체 상가업소 집계 (행정동 단위, 업종별)
create table if not exists seoul_store_stats (
  id               bigserial primary key,
  dong_name        text        not null,  -- 행정동명
  dong_code        text,                  -- 행정동 코드
  gu_name          text,                  -- 자치구명
  industry_name    text        not null,  -- 업종명 (e.g. 커피-음료)
  store_count      int         not null default 0,
  new_stores_1y    int         not null default 0,
  closed_stores_1y int         not null default 0,
  survival_rate    numeric,
  quarter          text,                  -- e.g. '20243' (2024년 3분기)
  fetched_at       timestamptz not null default now(),
  unique (dong_code, industry_name, quarter)
);

-- 서울 전체 유동인구 (행정동 단위)
create table if not exists seoul_flpop_stats (
  id                 bigserial primary key,
  dong_name          text        not null,
  dong_code          text,
  gu_name            text,
  daily_floating_pop int         not null default 0,
  quarter            text,
  fetched_at         timestamptz not null default now(),
  unique (dong_code, quarter)
);

-- 서울시 상권분석서비스(추정매출) — 상권 단위 월평균매출 (ML 레이블)
-- 출처: 서울 열린데이터광장 OA-15572 / data.go.kr 15147229
-- ※ dong_code 컬럼에 실제 저장되는 값은 상권_코드 (행정동 코드 아님)
create table if not exists sbiz_tradearea (
  id                   bigserial primary key,
  dong_name            text        not null,   -- 상권_코드_명 (상권명)
  dong_code            text,                   -- 상권_코드 (4-5자리)
  gu_name              text,
  industry_name        text,
  monthly_revenue_avg  numeric,    -- 분기당_매출_금액 ÷ 3 (원, 전 점포 합산 기준)
  store_count          int,        -- 분기당_매출_건수 (거래건수 — 점포 수 아님)
  delivery_count       int,
  reference_month      text,       -- 기준_년_코드 + 기준_분기_코드 e.g. '20243'
  created_at           timestamptz not null default now(),
  unique (dong_code, industry_name, reference_month)
);

-- 한국부동산원 소규모상가 임대료 (구 단위)
create table if not exists reb_rent (
  id           bigserial primary key,
  gu_name      text        not null,
  rent_per_sqm numeric     not null,  -- 천원/㎡
  quarter      text        not null,  -- e.g. '20243'
  created_at   timestamptz not null default now(),
  unique (gu_name, quarter)
);

-- 대중교통 위치 (지하철역 + 버스정류장)
create table if not exists transit_stops (
  id        bigserial primary key,
  name      text    not null,
  type      text    not null check (type in ('subway', 'bus')),
  lat       numeric not null,
  lng       numeric not null
);

create index if not exists transit_stops_type_idx on transit_stops(type);
