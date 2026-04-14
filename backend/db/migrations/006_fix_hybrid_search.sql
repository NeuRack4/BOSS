-- ============================================================
-- hybrid_search 함수 수정
--
-- 문제: FULL OUTER JOIN으로 인해 벡터 유사도 0%인 문서가
--       FTS 점수만으로 top 1에 오를 수 있었음.
--       예) 부가세 검색 → 식품위생법(내부에 "부가세" 언급) top 1 노출
--
-- 수정:
--   1. vector_ranked에 최소 코사인 유사도 임계값 적용
--   2. FULL OUTER JOIN → LEFT JOIN (벡터 결과만 후보, FTS는 부스팅용)
--   3. 파라미터로 임계값 조정 가능하도록 min_score 추가
-- ============================================================

create or replace function hybrid_search (
  query_text       text,
  query_embedding  vector(1024),
  match_count      int   default 10,
  filter_category  text  default null,
  rrf_k            int   default 60,
  min_score        float default 0.3   -- 최소 코사인 유사도 (핵심 추가)
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
    where
      (filter_category is null or category = filter_category)
      -- 핵심 수정: 최소 유사도 이하 문서를 후보에서 제외
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
    from documents
    where
      (filter_category is null or category = filter_category)
      and fts @@ plainto_tsquery('simple', query_text)
    order by ts_rank(fts, plainto_tsquery('simple', query_text)) desc
    limit match_count * 3
  ),
  rrf_combined as (
    select
      v.id,
      -- 핵심 수정: LEFT JOIN — 벡터 결과만 최종 후보
      -- FTS는 순위를 올려주는 boost 역할만 수행
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
  join documents d on d.id = r.id
  order by r.score desc
  limit match_count;
$$;
