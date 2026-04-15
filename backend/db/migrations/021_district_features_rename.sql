-- 021_district_features_rename.sql
-- district_features 컬럼명 정정 (실제 데이터와 이름 불일치 해소)
-- subway_count_500m / bus_stop_count_300m / delivery_count 는 실제로
-- 20대·30대·주말 유동인구를 담고 있었음 (features.py 참고)

alter table district_features
  rename column subway_count_500m  to pop_age_20;

alter table district_features
  rename column bus_stop_count_300m to pop_age_30;

alter table district_features
  rename column delivery_count      to pop_weekend;

alter table district_features
  rename column cafe_count          to monthly_txn_count;

comment on column district_features.pop_age_20          is '20대 유동인구';
comment on column district_features.pop_age_30          is '30대 유동인구';
comment on column district_features.pop_weekend         is '주말 유동인구';
comment on column district_features.monthly_txn_count   is '월 거래건수 (sbiz 기준)';
comment on column district_features.predicted_monthly_revenue is
  'ML 예측 월매출 — 기본 조건(좌석 30석, 10h, 객단가 5000원, 25일) 기준 (원/월)';
