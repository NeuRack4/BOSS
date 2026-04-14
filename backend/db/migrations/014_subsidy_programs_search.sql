-- ============================================================
-- 지원사업 공고 자체 테이블에서 하이브리드 검색
--
-- law_chunks 와 분리 — subsidy_programs 에 embedding 컬럼 직접 부착.
-- 공고 1건 = 1 임베딩 (별도 chunks 테이블 불필요).
-- ============================================================

alter table subsidy_programs
  add column if not exists embedding vector(1024);

create index if not exists subsidy_programs_embedding_idx
  on subsidy_programs using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists subsidy_programs_title_trgm_idx
  on subsidy_programs using gin (title gin_trgm_ops);

create index if not exists subsidy_programs_desc_trgm_idx
  on subsidy_programs using gin (description gin_trgm_ops);

-- 3-way RRF 하이브리드 검색
create or replace function search_subsidies(
  query_text       text,
  query_embedding  text,
  match_count      integer          default 10,
  rrf_k            integer          default 60,
  min_score        double precision default 0.3,
  min_trgm_score   double precision default 0.3
)
returns table (
  id bigint,
  external_id text,
  title text,
  organization text,
  region text,
  program_kind text,
  sub_kind text,
  target text,
  start_date date,
  end_date date,
  period_raw text,
  is_ongoing boolean,
  description text,
  detail_url text,
  external_url text,
  hashtags text,
  score double precision,
  similarity double precision
)
language plpgsql
as $$
declare
  qvec vector(1024) := query_embedding::vector(1024);
begin
  return query
  with
    vec_ranked as (
      select
        s.id,
        (1 - (s.embedding <=> qvec))::double precision as sim,
        row_number() over (order by s.embedding <=> qvec) as rnk
      from subsidy_programs s
      where s.embedding is not null
        and (1 - (s.embedding <=> qvec)) >= min_score
      order by s.embedding <=> qvec
      limit match_count * 3
    ),
    fts_ranked as (
      select
        s.id,
        row_number() over (
          order by ts_rank(
            to_tsvector('simple', coalesce(s.title, '') || ' ' || coalesce(s.description, '')),
            plainto_tsquery('simple', query_text)
          ) desc
        ) as rnk
      from subsidy_programs s
      where to_tsvector('simple', coalesce(s.title, '') || ' ' || coalesce(s.description, ''))
            @@ plainto_tsquery('simple', query_text)
      limit match_count * 3
    ),
    trg_ranked as (
      select
        s.id,
        row_number() over (
          order by greatest(
            word_similarity(query_text, coalesce(s.title, '')),
            word_similarity(query_text, coalesce(s.description, ''))
          ) desc
        ) as rnk
      from subsidy_programs s
      where greatest(
        word_similarity(query_text, coalesce(s.title, '')),
        word_similarity(query_text, coalesce(s.description, ''))
      ) >= min_trgm_score
      limit match_count * 3
    ),
    fused as (
      select
        coalesce(v.id, f.id, t.id) as id,
        (coalesce(1.0 / (rrf_k + v.rnk), 0)
         + coalesce(1.0 / (rrf_k + f.rnk), 0)
         + coalesce(1.0 / (rrf_k + t.rnk), 0))::double precision as rrf_score,
        v.sim as cos_sim
      from vec_ranked v
      full outer join fts_ranked f on v.id = f.id
      full outer join trg_ranked t on coalesce(v.id, f.id) = t.id
    )
  select
    s.id, s.external_id, s.title, s.organization, s.region,
    s.program_kind, s.sub_kind, s.target,
    s.start_date, s.end_date, s.period_raw, s.is_ongoing,
    s.description, s.detail_url, s.external_url, s.hashtags,
    fused.rrf_score as score,
    coalesce(fused.cos_sim, 0)::double precision as similarity
  from fused
  join subsidy_programs s on s.id = fused.id
  order by fused.rrf_score desc
  limit match_count;
end;
$$;
