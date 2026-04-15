-- 입지분석 개인화 세션 테이블
create table if not exists location_analysis_sessions (
  id                   bigserial primary key,
  user_id              text not null,

  -- A: 상권 추천 입력
  budget_monthly_rent  int,          -- 월 임대료 예산 (만원)
  target_age           text,         -- '20대' | '30대' | '혼합'
  preferred_area_type  text,         -- '골목상권' | '발달상권' | '전통시장' | '관광특구' | '무관'

  -- B: 매출 예측 입력
  seat_count           int,          -- 좌석 수
  operating_hours      float,        -- 일 영업시간
  avg_price            int,          -- 객단가 (원)
  operating_days       int,          -- 월 영업일

  -- 결과 (계산 후 저장)
  recommended_districts jsonb,       -- [{district, score, reasons, predicted_revenue}]
  revenue_prediction    jsonb,       -- {method1, method2, method3, ensemble, top_district}

  created_at timestamptz default now()
);

create index if not exists location_sessions_user_idx
  on location_analysis_sessions (user_id, created_at desc);
