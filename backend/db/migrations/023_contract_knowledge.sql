-- ============================================================
-- 서류 검토 RAG용 contract_knowledge_chunks 테이블 + 하이브리드 검색 함수
--
-- 목적:
--   근로계약서·임대차계약서·용역계약서·공급계약서·관련 법령 등
--   각종 서류 검토에 필요한 지식을 청킹·임베딩하여 저장하고,
--   하이브리드 3-way RRF(벡터 + FTS + trigram)로 검색한다.
--
-- 설계 원칙:
--   - law_chunks와 동일한 HNSW(m=16, ef_construction=64) 인덱스
--   - pg_trgm word_similarity로 한국어 복합어 대응
--   - query_embedding을 text로 받아 내부 ::vector 캐스팅 (PostgREST 워크어라운드)
--   - min_content_len=30 (계약서 특성상 짧은 항 허용 — law_chunks의 40보다 완화)
-- ============================================================

-- 1. 테이블 생성
create table if not exists contract_knowledge_chunks (
  id          bigserial primary key,
  category    text not null,  -- 'labor' | 'lease' | 'service' | 'supply' | 'law'
  source      text not null,  -- 파일명 or 법령명
  chunk_index int  not null default 0,
  content     text not null,
  embedding   vector(1024),   -- BAAI/bge-m3 (OpenAI 폴백 시 1536)
  metadata    jsonb,
  created_at  timestamptz default now()
);

-- 2. HNSW 인덱스 (카테고리 pre-filter 안정성 — law_chunks와 동일 파라미터)
create index if not exists contract_knowledge_embedding_idx
  on contract_knowledge_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 3. Trigram GIN 인덱스 (한국어 복합어 대응)
create index if not exists contract_knowledge_trgm_idx
  on contract_knowledge_chunks using gin (content gin_trgm_ops);

-- 4. FTS GIN 인덱스 (simple 토크나이저)
create index if not exists contract_knowledge_fts_idx
  on contract_knowledge_chunks using gin (to_tsvector('simple', content));

-- 5. search_contract_knowledge — 3-way RRF (vector + FTS + trigram)
drop function if exists search_contract_knowledge(text, text, int, text, int, double precision, double precision, integer);
drop function if exists search_contract_knowledge(text, text, integer, text, integer, double precision, double precision, integer);

create or replace function search_contract_knowledge(
  query_text       text,
  query_embedding  text,              -- PostgREST 직렬화 대응: text로 받아 내부 ::vector 캐스팅
  match_count      integer           default 8,
  filter_category  text              default null,
  rrf_k            integer           default 60,
  min_score        double precision  default 0.3,   -- 벡터 최소 코사인 유사도
  min_trgm_score   double precision  default 0.4,   -- trigram word_similarity 하한 (law_chunks의 0.5보다 완화)
  min_content_len  integer           default 30     -- 계약서 특성상 짧은 항 허용
)
returns table (
  id         bigint,
  content    text,
  metadata   jsonb,
  category   text,
  source     text,
  score      double precision,      -- RRF 점수 (정렬용)
  similarity double precision       -- 실제 코사인 유사도 % (사용자 표시용)
)
language sql stable as $$
  with q as (select query_embedding::vector as vec),
  -- 벡터 유사도 랭커
  vector_ranked as (
    select
      ck.id,
      1 - (ck.embedding <=> q.vec) as cos_sim,
      row_number() over (order by ck.embedding <=> q.vec) as rnk
    from contract_knowledge_chunks ck, q
    where (filter_category is null or ck.category = filter_category)
      and 1 - (ck.embedding <=> q.vec) >= min_score
      and char_length(ck.content) > min_content_len
    order by ck.embedding <=> q.vec
    limit match_count * 3
  ),
  -- FTS(simple) 랭커 — 정확 토큰 매칭 시 유용
  fts_ranked as (
    select
      ck.id,
      row_number() over (
        order by ts_rank(to_tsvector('simple', ck.content), plainto_tsquery('simple', query_text)) desc
      ) as rnk
    from contract_knowledge_chunks ck
    where (filter_category is null or ck.category = filter_category)
      and to_tsvector('simple', ck.content) @@ plainto_tsquery('simple', query_text)
      and char_length(ck.content) > min_content_len
    limit match_count * 3
  ),
  -- Word-trigram 유사도 랭커 — 한국어 복합어 부분 매칭
  trgm_ranked as (
    select
      ck.id,
      row_number() over (order by word_similarity(query_text, ck.content) desc) as rnk
    from contract_knowledge_chunks ck
    where (filter_category is null or ck.category = filter_category)
      and word_similarity(query_text, ck.content) >= min_trgm_score
      and char_length(ck.content) > min_content_len
    order by word_similarity(query_text, ck.content) desc
    limit match_count * 3
  ),
  -- 3-way RRF: 벡터 후보를 기준으로 FTS/trigram 순위를 boost 합산
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
    ck.id,
    ck.content,
    ck.metadata,
    ck.category,
    ck.source,
    r.rrf      as score,
    r.cos_sim  as similarity
  from rrf_combined r
  join contract_knowledge_chunks ck on ck.id = r.id
  order by r.rrf desc
  limit match_count;
$$;
