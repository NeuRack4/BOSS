-- ============================================================
-- 한국어 FTS 커버리지 개선 + 짧은 제목 청크 제외
--
-- 문제:
--   1. PostgreSQL `simple` 토크나이저가 한국어 복합어 분리 불가.
--      "최저임금" 쿼리가 "최저임금법" 문서에 매칭되지 않아 FTS 0건.
--      → 하이브리드 검색이 벡터 단독 검색으로 퇴화.
--   2. "제24조(정부의 지원)" 같은 제목만 있는 짧은 article 청크가
--      벡터 단독일 때 상위로 올라와 결과 오염.
--
-- 수정:
--   1. pg_trgm 기반 trigram 유사도 인덱스 생성 (글자 n-gram — 복합어 대응)
--   2. hybrid_search에 trigram 랭커를 3번째 RRF 성분으로 추가
--   3. 모든 랭커에 char_length(content) > 40 필터 적용
--      — 제목만 있는 article 청크 제외 (본문은 paragraph 자식 청크에 있음,
--        parent_doc_id 확장으로 컨텍스트는 여전히 확보)
-- ============================================================

-- 1. pg_trgm 인덱스 (이미 확장은 설치돼 있음)
create index if not exists law_chunks_content_trgm_idx
  on law_chunks
  using gin (content gin_trgm_ops);

-- 2. hybrid_search — 3-way RRF + 길이 필터
drop function if exists hybrid_search(text, vector, int, text, int, float);
drop function if exists hybrid_search(text, vector(1024), int, text, int, float);
drop function if exists hybrid_search(text, text, int, text, int, float);
drop function if exists hybrid_search(text, text, integer, text, integer, double precision);
drop function if exists hybrid_search(text, text, integer, text, integer, double precision, double precision);
drop function if exists hybrid_search(text, text, integer, text, integer, double precision, double precision, integer);

create or replace function hybrid_search(
  query_text       text,
  query_embedding  text,
  match_count      integer           default 10,
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
  score          double precision,
  similarity     double precision
)
language sql stable as $$
  with q as (select query_embedding::vector as vec),
  -- 벡터 유사도 랭커
  vector_ranked as (
    select
      lc.id,
      1 - (lc.embedding <=> q.vec) as cos_sim,
      row_number() over (order by lc.embedding <=> q.vec) as rnk
    from law_chunks lc, q
    where (filter_category is null or lc.category = filter_category)
      and 1 - (lc.embedding <=> q.vec) >= min_score
      and char_length(lc.content) > min_content_len
    order by lc.embedding <=> q.vec
    limit match_count * 3
  ),
  -- FTS(simple) 랭커 — 한국어 복합어 제약 있으나 정확 토큰 매칭 시 유용
  fts_ranked as (
    select
      lc.id,
      row_number() over (
        order by ts_rank(to_tsvector('simple', lc.content), plainto_tsquery('simple', query_text)) desc
      ) as rnk
    from law_chunks lc
    where (filter_category is null or lc.category = filter_category)
      and to_tsvector('simple', lc.content) @@ plainto_tsquery('simple', query_text)
      and char_length(lc.content) > min_content_len
    limit match_count * 3
  ),
  -- Word-trigram 유사도 랭커 — 쿼리 문자열을 content 내 부분 문자열과 매칭
  -- similarity()는 전체 문서 대비 비율이라 긴 본문에서 값이 낮음.
  -- word_similarity(query, content)는 content에서 쿼리와 가장 유사한 구간을
  -- 찾아 점수화 → "최저임금" ↔ "최저임금법"이 포함된 긴 문서도 고점 매칭.
  trgm_ranked as (
    select
      lc.id,
      row_number() over (order by word_similarity(query_text, lc.content) desc) as rnk
    from law_chunks lc
    where (filter_category is null or lc.category = filter_category)
      and word_similarity(query_text, lc.content) >= min_trgm_score
      and char_length(lc.content) > min_content_len
    order by word_similarity(query_text, lc.content) desc
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
    lc.id, lc.content, lc.metadata, lc.chunk_type,
    lc.paragraph_no, lc.paragraph_char, lc.parent_doc_id,
    r.rrf as score,
    r.cos_sim as similarity
  from rrf_combined r
  join law_chunks lc on lc.id = r.id
  order by r.rrf desc
  limit match_count;
$$;
