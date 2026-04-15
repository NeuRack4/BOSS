-- 행정동별 ML 피처 테이블 (학습/추론 공용)
create table if not exists district_features (
  id                       bigserial primary key,
  dong_name                text        not null,
  dong_code                text,
  gu_name                  text,

  -- 카페 현황
  cafe_count               int,
  new_stores_1y            int,
  closed_stores_1y         int,
  survival_rate            numeric,
  cafe_density             numeric,    -- 카페 / 전체 상가 비율

  -- 유동인구
  daily_floating_pop       int,

  -- 접근성
  subway_count_500m        int,        -- 반경 500m 내 지하철역 수
  bus_stop_count_300m      int,        -- 반경 300m 내 버스정류장 수

  -- 임대료 (구 단위 매핑)
  rent_per_sqm             numeric,

  -- 소상공인365
  delivery_count           int,

  -- 레이블 (소상공인365 점포당 월평균매출)
  monthly_revenue_label    numeric,

  -- ML 예측값
  predicted_monthly_revenue numeric,

  reference_period         text,       -- e.g. '20243'
  updated_at               timestamptz not null default now(),
  unique (dong_code, reference_period)
);

create index if not exists district_features_gu_idx on district_features(gu_name);
create index if not exists district_features_dong_idx on district_features(dong_name);
