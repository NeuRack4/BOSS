-- documents 테이블 전용 벡터 검색 함수
-- mapo_stats / mapo_population / mapo_commercial_change / strategy 등 모든 카테고리 지원
create or replace function match_docs(
  query_embedding  text,
  filter_category  text,
  match_threshold  double precision default 0.4,
  match_count      integer          default 5
)
returns table (
  id         bigint,
  content    text,
  metadata   jsonb,
  similarity double precision
)
language sql stable
as $$
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding::vector) as similarity
  from documents
  where
    category = filter_category
    and 1 - (embedding <=> query_embedding::vector) > match_threshold
  order by embedding <=> query_embedding::vector
  limit match_count;
$$;
