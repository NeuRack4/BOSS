-- ============================================================
-- 법령 전용 테이블 분리
--
-- 배경: documents 테이블에 mapo_stats(상권 통계)와 법령 청크가
--       함께 있어 RAG 검색 시 오염 발생.
--       (예: 부가세 검색 → 마포구 매출 통계 top 1 노출)
--
-- 변경:
--   - law_chunks 테이블 신설 (법령 전용)
--   - hybrid_search / match_documents 함수를 law_chunks 기준으로 재생성
--   - documents 테이블은 mapo_stats 카테고리만 보존
-- ============================================================

-- 1. law_chunks 테이블 생성
create table if not exists law_chunks (
  id             bigserial primary key,
  category       text        not null,   -- license | tax | labor | lease | subsidy | regulation
  source         text,
  chunk_index    int,
  content        text        not null,
  embedding      vector(1024),
  chunk_type     text        not null    default 'article',
  paragraph_no   int,
  paragraph_char text,
  parent_doc_id  bigint      references law_chunks(id) on delete cascade,
  metadata       jsonb,
  fts            tsvector    generated always as (to_tsvector('simple', content)) stored,
  created_at     timestamptz default now()
);

-- 2. 인덱스
create index if not exists law_chunks_embedding_idx
  on law_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists law_chunks_fts_idx
  on law_chunks using gin(fts);

create index if not exists law_chunks_category_idx
  on law_chunks(category);

create index if not exists law_chunks_parent_doc_idx
  on law_chunks(parent_doc_id)
  where parent_doc_id is not null;

-- 3. documents에서 법령 데이터 제거 (mapo_stats만 보존)
delete from documents
where category != 'mapo_stats';

-- 4. match_documents → law_chunks 기준으로 재생성 (backward compat)
drop function if exists match_documents(vector(1024), float, int, text);

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
  from law_chunks
  where
    (filter_category is null or category = filter_category)
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 5. hybrid_search → law_chunks 기준으로 재생성
--    (006_fix_hybrid_search.sql의 LEFT JOIN + min_score 수정 포함)
drop function if exists hybrid_search(text, vector, int, text, int, float);
drop function if exists hybrid_search(text, vector(1024), int, text, int, float);

create or replace function hybrid_search (
  query_text       text,
  query_embedding  vector(1024),
  match_count      int   default 10,
  filter_category  text  default null,
  rrf_k            int   default 60,
  min_score        float default 0.3
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
    from law_chunks
    where
      (filter_category is null or category = filter_category)
      and 1 - (embedding <=> query_embedding) >= min_score
    order by embedding <=> query_embedding
    limit match_count * 3
  ),
  fts_ranked as (
    select
      id,
      row_number() over (
        order by ts_rank(fts, plainto_tsquery('simple', query_text)) desc
      ) as rank
    from law_chunks
    where
      (filter_category is null or category = filter_category)
      and fts @@ plainto_tsquery('simple', query_text)
    order by ts_rank(fts, plainto_tsquery('simple', query_text)) desc
    limit match_count * 3
  ),
  rrf_combined as (
    select
      v.id,
      (1.0 / (rrf_k + v.rank)) +
      coalesce(1.0 / (rrf_k + f.rank), 0.0) as score
    from vector_ranked v
    left join fts_ranked f on v.id = f.id
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
  join law_chunks d on d.id = r.id
  order by r.score desc
  limit match_count;
$$;
