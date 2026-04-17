-- 022_doc_review.sql
-- 서류 검토 이력 테이블 생성 (doc_reviews)
-- 사용자가 업로드한 계약서·제안서 등을 AI가 분석한 결과를 저장한다.

-- review_result jsonb 구조:
-- {
--   "summary": "전반적으로 귀사에 불리한 계약 (35:65)",
--   "benefit_ratio": 35,          -- 의뢰인에게 유리한 비율 (%)
--   "risk_ratio": 65,             -- 의뢰인에게 불리한 비율 (%)
--   "risk_clauses": [
--     {
--       "clause": "원문 조항 텍스트",
--       "reason": "왜 위험한지 설명",
--       "loss_percent": 30,        -- 해당 조항이 전체 리스크에서 차지하는 비중 (%)
--       "suggestion": "상대가 수락 가능한 수정안"
--     }
--   ],
--   "negotiation_strategy": "전체 협상 전략 요약"
-- }

create table if not exists doc_reviews (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null,
  title         text        not null,                   -- 파일명 or 사용자 입력 제목
  doc_type      text        not null default '기타',    -- '계약서' | '제안서' | '기타'
  content       text        not null,                   -- 추출된 원문 텍스트
  file_path     text,                                   -- Supabase Storage 경로 (파일 업로드 시)
  review_result jsonb,                                  -- AI 분석 결과 (위 구조 참고)
  created_at    timestamptz default now()
);

-- RLS
alter table doc_reviews enable row level security;

create policy "doc_reviews_select" on doc_reviews
  for select using (user_id = auth.uid());

create policy "doc_reviews_insert" on doc_reviews
  for insert with check (user_id = auth.uid());

create policy "doc_reviews_delete" on doc_reviews
  for delete using (user_id = auth.uid());

-- 인덱스
create index if not exists doc_reviews_user_id_idx    on doc_reviews (user_id);
create index if not exists doc_reviews_created_at_idx on doc_reviews (created_at desc);
