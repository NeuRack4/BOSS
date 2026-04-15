-- 서울 열린데이터 API 응답 캐시 테이블
-- 분기 단위 데이터이므로 단일 행(id=1)으로 관리
create table if not exists seoul_open_cache (
  id         int primary key default 1 check (id = 1),  -- 항상 1행
  data       jsonb       not null,
  fetched_at timestamptz not null default now()
);
