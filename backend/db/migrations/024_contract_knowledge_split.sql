-- ============================================================
-- contract_knowledge_chunks → law/pattern 테이블 분리
--
-- 변경 사항:
--   1. contract_knowledge_chunks + search_contract_knowledge 제거
--   2. law_contract_knowledge_chunks 생성
--      - law_chunks와 동일 스키마 (article + paragraph 2단계 계층)
--      - search_law_contract_knowledge RPC (3-way RRF)
--   3. pattern_contract_knowledge_chunks 생성
--      - risk_level / pattern_name / contract_type 전용 컬럼
--      - search_pattern_contract_knowledge RPC (3-way RRF + level/type 필터)
-- ============================================================

-- ── 0. 기존 함수/테이블 제거 ──────────────────────────────────────────────────
drop function if exists search_contract_knowledge(text, text, integer, text, integer, double precision, double precision, integer);
drop table if exists contract_knowledge_chunks cascade;

-- ============================================================
-- 1. law_contract_knowledge_chunks  (law_chunks 동일 스키마)
-- ============================================================
create table if not exists law_contract_knowledge_chunks (
  id             bigserial primary key,
  category       text not null,   -- 'labor' | 'lease' | 'service' | 'supply' | 'civil' | 'law'
  source         text not null,   -- 법령명
  chunk_index    int  not null default 0,
  chunk_type     text,            -- 'article' | 'paragraph'
  paragraph_no   int,             -- 항 번호 (paragraph 청크만)
  paragraph_char text,            -- 항 기호 (①②③ 등)
  parent_doc_id  bigint references law_contract_knowledge_chunks(id),
  content        text not null,
  embedding      vector(1024),    -- BAAI/bge-m3 (OpenAI 폴백 시 1536)
  metadata       jsonb,
  created_at     timestamptz default now()
);

-- HNSW 벡터 인덱스 (law_chunks와 동일 파라미터)
create index if not exists law_ck_embedding_idx
  on law_contract_knowledge_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Trigram GIN 인덱스 (한국어 복합어 대응)
create index if not exists law_ck_trgm_idx
  on law_contract_knowledge_chunks using gin (content gin_trgm_ops);

-- FTS GIN 인덱스 (simple 토크나이저)
create index if not exists law_ck_fts_idx
  on law_contract_knowledge_chunks using gin (to_tsvector('simple', content));

-- search_law_contract_knowledge — 3-way RRF (hybrid_search와 동일 로직)
create or replace function search_law_contract_knowledge(
  query_text       text,
  query_embedding  text,              -- PostgREST 직렬화 대응: text → 내부 ::vector 캐스팅
  match_count      integer           default 6,
  filter_category  text              default null,
  rrf_k            integer           default 60,
  min_score        double precision  default 0.3,
  min_trgm_score   double precision  default 0.5,
  min_content_len  integer           default 40
)
returns table (
  id             bigint,
  content        text,
  metadata       jsonb,
  chunk_type     text,
  paragraph_no   integer,
  paragraph_char text,
  parent_doc_id  bigint,
  score          double precision,   -- RRF 점수 (정렬용)
  similarity     double precision    -- 코사인 유사도 (표시용)
)
language sql stable as $$
  with q as (select query_embedding::vector as vec),
  -- 벡터 유사도 랭커
  vector_ranked as (
    select
      lc.id,
      1 - (lc.embedding <=> q.vec) as cos_sim,
      row_number() over (order by lc.embedding <=> q.vec) as rnk
    from law_contract_knowledge_chunks lc, q
    where (filter_category is null or lc.category = filter_category)
      and 1 - (lc.embedding <=> q.vec) >= min_score
      and char_length(lc.content) > min_content_len
    order by lc.embedding <=> q.vec
    limit match_count * 3
  ),
  -- FTS(simple) 랭커
  fts_ranked as (
    select
      lc.id,
      row_number() over (
        order by ts_rank(to_tsvector('simple', lc.content), plainto_tsquery('simple', query_text)) desc
      ) as rnk
    from law_contract_knowledge_chunks lc
    where (filter_category is null or lc.category = filter_category)
      and to_tsvector('simple', lc.content) @@ plainto_tsquery('simple', query_text)
      and char_length(lc.content) > min_content_len
    limit match_count * 3
  ),
  -- Word-trigram 랭커 (한국어 복합어 부분 매칭)
  trgm_ranked as (
    select
      lc.id,
      row_number() over (order by word_similarity(query_text, lc.content) desc) as rnk
    from law_contract_knowledge_chunks lc
    where (filter_category is null or lc.category = filter_category)
      and word_similarity(query_text, lc.content) >= min_trgm_score
      and char_length(lc.content) > min_content_len
    order by word_similarity(query_text, lc.content) desc
    limit match_count * 3
  ),
  rrf_combined as (
    select
      v.id,
      v.cos_sim,
      (1.0 / (rrf_k + v.rnk)) +
      coalesce(1.0 / (rrf_k + f.rnk), 0.0) +
      coalesce(1.0 / (rrf_k + t.rnk), 0.0) as rrf
    from vector_ranked v
    left join fts_ranked  f on v.id = f.id
    left join trgm_ranked t on v.id = t.id
  )
  select
    lc.id, lc.content, lc.metadata, lc.chunk_type,
    lc.paragraph_no, lc.paragraph_char, lc.parent_doc_id,
    r.rrf      as score,
    r.cos_sim  as similarity
  from rrf_combined r
  join law_contract_knowledge_chunks lc on lc.id = r.id
  order by r.rrf desc
  limit match_count;
$$;

-- ============================================================
-- 2. pattern_contract_knowledge_chunks  (위험 조항 패턴 전용)
-- ============================================================
create table if not exists pattern_contract_knowledge_chunks (
  id             bigserial primary key,
  category       text not null,   -- 'labor' | 'lease' | 'service' | 'supply' | 'franchise' | 'partnership'
  source         text not null,   -- 파일명 (예: labor_contract.md)
  chunk_index    int  not null default 0,
  risk_level     text,            -- 'High' | 'Mid' | 'Low'  (pre-filter 가능한 전용 컬럼)
  pattern_name   text,            -- 패턴 이름
  contract_type  text,            -- 계약서 유형 (category와 동일값 — pre-filter 편의용)
  content        text not null,
  embedding      vector(1024),
  metadata       jsonb,
  created_at     timestamptz default now(),
  unique (source, chunk_index)
);

-- HNSW 벡터 인덱스
create index if not exists pattern_ck_embedding_idx
  on pattern_contract_knowledge_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Trigram GIN 인덱스
create index if not exists pattern_ck_trgm_idx
  on pattern_contract_knowledge_chunks using gin (content gin_trgm_ops);

-- FTS GIN 인덱스
create index if not exists pattern_ck_fts_idx
  on pattern_contract_knowledge_chunks using gin (to_tsvector('simple', content));

-- risk_level + contract_type 복합 B-tree (pre-filter 전용)
create index if not exists pattern_ck_filter_idx
  on pattern_contract_knowledge_chunks (risk_level, contract_type);

-- search_pattern_contract_knowledge — 3-way RRF + risk_level/contract_type 필터
create or replace function search_pattern_contract_knowledge(
  query_text           text,
  query_embedding      text,
  match_count          integer           default 4,
  filter_risk_level    text              default null,  -- 'High' | 'Mid' | 'Low'
  filter_contract_type text              default null,  -- 'labor' | 'lease' | ...
  rrf_k                integer           default 60,
  min_score            double precision  default 0.25,  -- 패턴 텍스트 특성상 완화
  min_trgm_score       double precision  default 0.35,
  min_content_len      integer           default 30
)
returns table (
  id             bigint,
  content        text,
  metadata       jsonb,
  category       text,
  source         text,
  risk_level     text,
  pattern_name   text,
  contract_type  text,
  score          double precision,
  similarity     double precision
)
language sql stable as $$
  with q as (select query_embedding::vector as vec),
  vector_ranked as (
    select
      pc.id,
      1 - (pc.embedding <=> q.vec) as cos_sim,
      row_number() over (order by pc.embedding <=> q.vec) as rnk
    from pattern_contract_knowledge_chunks pc, q
    where (filter_risk_level    is null or pc.risk_level    = filter_risk_level)
      and (filter_contract_type is null or pc.contract_type = filter_contract_type)
      and 1 - (pc.embedding <=> q.vec) >= min_score
      and char_length(pc.content) > min_content_len
    order by pc.embedding <=> q.vec
    limit match_count * 3
  ),
  fts_ranked as (
    select
      pc.id,
      row_number() over (
        order by ts_rank(to_tsvector('simple', pc.content), plainto_tsquery('simple', query_text)) desc
      ) as rnk
    from pattern_contract_knowledge_chunks pc
    where (filter_risk_level    is null or pc.risk_level    = filter_risk_level)
      and (filter_contract_type is null or pc.contract_type = filter_contract_type)
      and to_tsvector('simple', pc.content) @@ plainto_tsquery('simple', query_text)
      and char_length(pc.content) > min_content_len
    limit match_count * 3
  ),
  trgm_ranked as (
    select
      pc.id,
      row_number() over (order by word_similarity(query_text, pc.content) desc) as rnk
    from pattern_contract_knowledge_chunks pc
    where (filter_risk_level    is null or pc.risk_level    = filter_risk_level)
      and (filter_contract_type is null or pc.contract_type = filter_contract_type)
      and word_similarity(query_text, pc.content) >= min_trgm_score
      and char_length(pc.content) > min_content_len
    order by word_similarity(query_text, pc.content) desc
    limit match_count * 3
  ),
  rrf_combined as (
    select
      v.id,
      v.cos_sim,
      (1.0 / (rrf_k + v.rnk)) +
      coalesce(1.0 / (rrf_k + f.rnk), 0.0) +
      coalesce(1.0 / (rrf_k + t.rnk), 0.0) as rrf
    from vector_ranked v
    left join fts_ranked  f on v.id = f.id
    left join trgm_ranked t on v.id = t.id
  )
  select
    pc.id, pc.content, pc.metadata, pc.category, pc.source,
    pc.risk_level, pc.pattern_name, pc.contract_type,
    r.rrf      as score,
    r.cos_sim  as similarity
  from rrf_combined r
  join pattern_contract_knowledge_chunks pc on pc.id = r.id
  order by r.rrf desc
  limit match_count;
$$;
