-- ============================================================
-- BOSS DB 초기 스키마
-- Supabase SQL Editor에서 순서대로 실행하세요.
-- ============================================================

-- 0. pgvector 활성화 (Supabase 유료 플랜 내장)
create extension if not exists vector;

-- ============================================================
-- 1. 관계형 테이블
-- ============================================================

-- 창업자 프로파일
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  business_type text not null check (business_type in ('cafe','bakery','snack')),
  region        text not null,          -- 서울 자치구
  stage         text not null default 'setup',
  created_at    timestamptz default now()
);

-- 창업 단계 상태머신
create table if not exists founder_state (
  id          bigserial primary key,
  user_id     uuid references users(id) on delete cascade,
  stage       text not null,
  sub_stage   text not null,
  metadata    jsonb default '{}',
  updated_at  timestamptz default now(),
  unique (user_id)
);

-- 트리거 이력
create table if not exists trigger_log (
  id            bigserial primary key,
  user_id       uuid references users(id) on delete cascade,
  trigger_type  text not null,
  message       text not null,
  draft_url     text,
  sent_at       timestamptz default now(),
  read_at       timestamptz
);

-- 지원사업 매칭 결과
create table if not exists subsidy_matches (
  id          bigserial primary key,
  user_id     uuid references users(id) on delete cascade,
  program_id  text not null,
  score       float not null,
  deadline    date,
  status      text not null default 'pending'  -- pending | applied | rejected
);

-- 생성된 서류 초안
create table if not exists drafts (
  id            bigserial primary key,
  user_id       uuid references users(id) on delete cascade,
  type          text not null,
  storage_path  text not null,
  metadata      jsonb default '{}',
  created_at    timestamptz default now()
);

-- ============================================================
-- 2. 벡터 테이블 (RAG)
-- ============================================================

create table if not exists documents (
  id          bigserial primary key,
  category    text not null,    -- license | tax | labor | lease | subsidy
  source      text not null,    -- 출처 (예: 식품위생법 시행규칙)
  chunk_index int  not null,
  content     text not null,
  embedding   vector(1536),     -- text-embedding-3-small
  metadata    jsonb default '{}',
  created_at  timestamptz default now()
);

create index if not exists documents_embedding_idx
  on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================================
-- 3. 유사도 검색 함수
-- ============================================================

create or replace function match_documents (
  query_embedding  vector(1536),
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

-- ============================================================
-- 4. RLS (Row Level Security)
-- ============================================================

alter table users          enable row level security;
alter table founder_state  enable row level security;
alter table trigger_log    enable row level security;
alter table subsidy_matches enable row level security;
alter table drafts         enable row level security;

-- 사용자는 본인 데이터만 조회/수정 가능
create policy "users_own_data" on users
  for all using (auth.uid() = id);

create policy "founder_state_own" on founder_state
  for all using (auth.uid() = user_id);

create policy "trigger_log_own" on trigger_log
  for all using (auth.uid() = user_id);

create policy "subsidy_matches_own" on subsidy_matches
  for all using (auth.uid() = user_id);

create policy "drafts_own" on drafts
  for all using (auth.uid() = user_id);
