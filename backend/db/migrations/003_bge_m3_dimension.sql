-- ============================================================
-- BOSS DB 마이그레이션 003 — 임베딩 차원 변경
-- OpenAI text-embedding-3-small (1536) → BAAI/bge-m3 (1024)
-- 데이터가 없는 상태에서 실행하세요.
-- ============================================================

-- 1. 기존 IVFFlat 인덱스 제거 (차원 변경 전 필수)
drop index if exists documents_embedding_idx;

-- 2. 임베딩 컬럼 차원 변경 1536 → 1024
alter table documents
  alter column embedding type vector(1024);

-- 3. match_documents 함수 파라미터 차원 변경
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

-- 4. IVFFlat 인덱스 재생성 (데이터 삽입 후 실행 권장)
-- ⚠️  데이터가 충분히 쌓인 뒤 아래 인덱스를 수동으로 실행하세요.
--     (빈 테이블에서는 IVFFlat 빌드가 의미 없음)
-- create index documents_embedding_idx
--   on documents
--   using ivfflat (embedding vector_cosine_ops)
--   with (lists = 100);
