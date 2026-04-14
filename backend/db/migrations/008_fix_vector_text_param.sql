-- PostgREST가 Python list[float]을 vector 타입으로 자동 변환하지 못해
-- RPC 호출 시 embedding 파라미터가 NULL로 바인딩되는 문제 수정.
-- 파라미터 타입을 text로 받고, 함수 내부에서 ::vector 캐스팅.

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding text,
  match_threshold double precision,
  match_count integer,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (id bigint, content text, metadata jsonb, similarity double precision)
LANGUAGE sql STABLE AS $$
  WITH q AS (SELECT query_embedding::vector AS vec)
  SELECT
    d.id, d.content, d.metadata,
    1 - (d.embedding <=> q.vec) AS similarity
  FROM documents d, q
  WHERE
    (filter_category IS NULL OR d.category = filter_category)
    AND 1 - (d.embedding <=> q.vec) > match_threshold
  ORDER BY d.embedding <=> q.vec
  LIMIT match_count;
$$;


CREATE OR REPLACE FUNCTION match_mapo_stats(
  query_embedding text,
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE (id bigint, content text, metadata jsonb, similarity double precision)
LANGUAGE sql STABLE AS $$
  WITH q AS (SELECT query_embedding::vector AS vec)
  SELECT
    d.id, d.content, d.metadata,
    1 - (d.embedding <=> q.vec) AS similarity
  FROM documents d, q
  WHERE
    d.category = 'mapo_stats'
    AND 1 - (d.embedding <=> q.vec) > match_threshold
  ORDER BY d.embedding <=> q.vec
  LIMIT match_count;
$$;


CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding text,
  match_count integer DEFAULT 10,
  filter_category text DEFAULT NULL,
  rrf_k integer DEFAULT 60,
  min_score double precision DEFAULT 0.3
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  chunk_type text,
  paragraph_no integer,
  paragraph_char text,
  parent_doc_id bigint,
  score double precision
)
LANGUAGE sql STABLE AS $$
  WITH q AS (SELECT query_embedding::vector AS vec),
  vector_ranked AS (
    SELECT lc.id, ROW_NUMBER() OVER (ORDER BY lc.embedding <=> q.vec) AS rnk
    FROM law_chunks lc, q
    WHERE (filter_category IS NULL OR lc.category = filter_category)
      AND 1 - (lc.embedding <=> q.vec) >= min_score
    ORDER BY lc.embedding <=> q.vec
    LIMIT match_count * 3
  ),
  fts_ranked AS (
    SELECT lc.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(to_tsvector('simple', lc.content), plainto_tsquery('simple', query_text)) DESC
      ) AS rnk
    FROM law_chunks lc
    WHERE (filter_category IS NULL OR lc.category = filter_category)
      AND to_tsvector('simple', lc.content) @@ plainto_tsquery('simple', query_text)
    LIMIT match_count * 3
  ),
  merged AS (
    SELECT COALESCE(v.id, f.id) AS id,
      COALESCE(1.0 / (rrf_k + v.rnk), 0) + COALESCE(1.0 / (rrf_k + f.rnk), 0) AS rrf
    FROM vector_ranked v
    FULL OUTER JOIN fts_ranked f ON v.id = f.id
  )
  SELECT
    lc.id, lc.content, lc.metadata, lc.chunk_type,
    lc.paragraph_no, lc.paragraph_char, lc.parent_doc_id,
    m.rrf AS score
  FROM merged m
  JOIN law_chunks lc ON lc.id = m.id
  ORDER BY m.rrf DESC
  LIMIT match_count;
$$;
