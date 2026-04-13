-- ============================================================
-- BGE-M3 전환 마이그레이션
-- text-embedding-3-small (1536차원) → BAAI/bge-m3 (1024차원)
--
-- 주의: 기존 documents 테이블 데이터가 있다면 전부 삭제됩니다.
--       마이그레이션 전 재임베딩(ingest) 재실행이 필요합니다.
-- ============================================================

-- 1. 기존 인덱스 제거
drop index if exists documents_embedding_idx;

-- 2. 기존 검색 함수 제거
drop function if exists match_documents(vector(1536), float, int, text);

-- 3. 기존 embedding 컬럼 교체 (1536 → 1024)
--    PostgreSQL은 vector 차원 직접 변경 불가 → drop + add
alter table documents drop column if exists embedding;
alter table documents add column embedding vector(1024);

-- 4. 인덱스 재생성 (1024차원 기준)
create index documents_embedding_idx
  on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 5. 검색 함수 재생성 (1024차원 기준)
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
