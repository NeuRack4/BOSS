-- ============================================================
-- 법령 계층 청킹 + Hybrid Search 마이그레이션
-- 기존 documents 데이터 초기화 후 재수집 필요
-- ============================================================

-- 0. pg_trgm 활성화 (한국어 부분문자열 검색용)
create extension if not exists pg_trgm;

-- 1. 기존 데이터 및 인덱스/함수 초기화
truncate table documents restart identity cascade;

drop index if exists documents_embedding_idx;
drop function if exists match_documents(vector(1024), float, int, text);
drop function if exists match_documents(vector(1536), float, int, text);
drop function if exists hybrid_search;

-- 2. 새 컬럼 추가
alter table documents
  add column if not exists chunk_type    text not null default 'article',
  add column if not exists paragraph_no  int,
  add column if not exists paragraph_char text,
  add column if not exists parent_doc_id bigint references documents(id) on delete cascade;

-- 3. FTS 컬럼 추가 (simple 딕셔너리 — 한국어 공백 기반 토큰)
alter table documents
  add column if not exists fts tsvector
    generated always as (to_tsvector('simple', content)) stored;

-- 4. 인덱스 재생성
-- 벡터 유사도 검색
create index documents_embedding_idx
  on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- FTS 인덱스
create index documents_fts_idx
  on documents using gin(fts);

-- 부분문자열 검색 (pg_trgm)
create index documents_content_trgm_idx
  on documents using gin(content gin_trgm_ops);

-- parent_doc_id 조회 최적화
create index documents_parent_doc_idx
  on documents(parent_doc_id)
  where parent_doc_id is not null;

-- 5. 기존 벡터 유사도 함수 재생성 (backward compat)
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

-- 6. Hybrid Search 함수 (RRF: Reciprocal Rank Fusion)
--    벡터 검색 순위 + FTS 순위를 1/(k+rank) 공식으로 합산
create or replace function hybrid_search (
  query_text       text,
  query_embedding  vector(1024),
  match_count      int  default 10,
  filter_category  text default null,
  rrf_k            int  default 60
)
returns table (
  id             bigint,
  content        text,
  metadata       jsonb,
  chunk_type     text,
  paragraph_no   int,
  paragraph_char text,
  parent_doc_id  bigint,
  score          float
)
language sql stable as $$
  with vector_ranked as (
    select
      id,
      row_number() over (order by embedding <=> query_embedding) as rank
    from documents
    where filter_category is null or category = filter_category
    order by embedding <=> query_embedding
    limit match_count * 3
  ),
  fts_ranked as (
    select
      id,
      row_number() over (
        order by ts_rank(fts, plainto_tsquery('simple', query_text)) desc
      ) as rank
    from documents
    where
      (filter_category is null or category = filter_category)
      and fts @@ plainto_tsquery('simple', query_text)
    order by ts_rank(fts, plainto_tsquery('simple', query_text)) desc
    limit match_count * 3
  ),
  rrf_combined as (
    select
      coalesce(v.id, f.id) as id,
      coalesce(1.0 / (rrf_k + v.rank), 0.0) +
      coalesce(1.0 / (rrf_k + f.rank), 0.0) as score
    from vector_ranked v
    full outer join fts_ranked f on v.id = f.id
  )
  select
    d.id,
    d.content,
    d.metadata,
    d.chunk_type,
    d.paragraph_no,
    d.paragraph_char,
    d.parent_doc_id,
    r.score
  from rrf_combined r
  join documents d on d.id = r.id
  order by r.score desc
  limit match_count;
$$;
