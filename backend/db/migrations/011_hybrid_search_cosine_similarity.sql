-- ============================================================
-- hybrid_search 함수에 실제 코사인 유사도 컬럼 추가
--
-- 문제: 기존 score 컬럼은 RRF(Reciprocal Rank Fusion) 점수로,
--       rrf_k=60 기준 최댓값 약 0.033(3.3%) 수준이라
--       프론트에서 × 100 해서 표시하면 "3%" 같은 오해 유발.
--
-- 수정: RRF score는 내부 정렬용으로 유지하고,
--       실제 코사인 유사도(similarity)를 별도 컬럼으로 반환.
--
-- 주의: 008_fix_vector_text_param.sql에서 text 파라미터 버전으로 교체됨.
--       (PostgREST가 Python list[float]을 vector로 직렬화 못하기 때문)
--       모든 오버로드를 drop한 뒤 text 버전만 재생성.
-- ============================================================

drop function if exists hybrid_search(text, vector, int, text, int, float);
drop function if exists hybrid_search(text, vector(1024), int, text, int, float);
drop function if exists hybrid_search(text, text, int, text, int, float);
drop function if exists hybrid_search(text, text, integer, text, integer, double precision);

create or replace function hybrid_search(
  query_text       text,
  query_embedding  text,
  match_count      integer           default 10,
  filter_category  text              default null,
  rrf_k            integer           default 60,
  min_score        double precision  default 0.3
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
  vector_ranked as (
    select
      lc.id,
      1 - (lc.embedding <=> q.vec) as cos_sim,
      row_number() over (order by lc.embedding <=> q.vec) as rnk
    from law_chunks lc, q
    where (filter_category is null or lc.category = filter_category)
      and 1 - (lc.embedding <=> q.vec) >= min_score
    order by lc.embedding <=> q.vec
    limit match_count * 3
  ),
  fts_ranked as (
    select
      lc.id,
      row_number() over (
        order by ts_rank(to_tsvector('simple', lc.content), plainto_tsquery('simple', query_text)) desc
      ) as rnk
    from law_chunks lc
    where (filter_category is null or lc.category = filter_category)
      and to_tsvector('simple', lc.content) @@ plainto_tsquery('simple', query_text)
    limit match_count * 3
  ),
  rrf_combined as (
    select
      v.id,
      v.cos_sim,
      (1.0 / (rrf_k + v.rnk)) +
      coalesce(1.0 / (rrf_k + f.rnk), 0.0) as rrf
    from vector_ranked v
    left join fts_ranked f on v.id = f.id
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
