-- ============================================================
-- BGE-M3 임베딩 모델 전환 (1536 → 1024차원)
-- Supabase SQL Editor에서 실행하세요.
-- 주의: 기존 documents 데이터가 있으면 전부 삭제됩니다.
-- ============================================================

-- 1. 기존 인덱스 제거
drop index if exists documents_embedding_idx;

-- 2. 기존 벡터 데이터 초기화 (차원 변경은 재삽입 필요)
truncate table documents;

-- 3. 컬럼 차원 변경
alter table documents
  alter column embedding type vector(1024);

-- 4. 기존 match_documents 함수 교체
create or replace function match_documents (
  query_embedding  vector(1024),
  match_threshold  float,
  match_count      int,
  filter_category  text default null
)
returns table (id bigint, content text, metadata jsonb, similarity float)
language sql stable as $$
  select
    id, content, metadata,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  where
    (filter_category is null or category = filter_category)
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 5. 인덱스 재생성
create index documents_embedding_idx
  on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
