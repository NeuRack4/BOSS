-- ============================================================
-- 날씨 데이터 테이블 (기상청 ASOS 서울 관측소 #108)
-- 인사이트 분석 시 날씨-매출 상관관계 제공
-- ============================================================

create table if not exists weather_data (
  id         bigserial primary key,
  date       date unique not null,
  avg_temp   numeric(4,1),   -- 평균기온 (℃)
  rain_mm    numeric(6,1),   -- 강수량 (mm), null이면 관측 없음
  is_rainy   boolean generated always as (rain_mm > 0) stored,
  max_wind   numeric(4,1),   -- 최대풍속 (m/s)
  avg_humid  numeric(5,1),   -- 평균습도 (%)
  created_at timestamptz default now()
);

-- 날짜 범위 조회 최적화
create index if not exists weather_data_date_idx on weather_data (date);
