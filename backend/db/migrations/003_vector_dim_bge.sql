-- ============================================================
-- BOSS DB 마이그레이션 003: 임베딩 모델 변경
-- OpenAI text-embedding-3-small (1536d) → BGE-M3 (1024d)
--
-- ⚠️  기존 documents 테이블 데이터가 있다면 재수집 필요
-- ============================================================

-- 1. 기존 인덱스 제거
drop index if exists documents_embedding_idx;

-- 2. 벡터 컬럼 교체 (pgvector는 차원 변경을 ALTER로 지원하지 않음)
alter table documents drop column if exists embedding;
alter table documents add column embedding vector(1024);

-- 3. match_documents 함수 재정의 (1024차원)
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

-- 4. 인덱스 재생성 (lists는 예상 문서 수에 따라 조정: rows / 1000)
create index documents_embedding_idx
  on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
