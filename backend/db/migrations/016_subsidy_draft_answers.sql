-- ============================================================
-- 016: 지원사업 신청서 답변 저장
--
-- 변경 사항:
--   1. subsidy_attachments.cards_json 컬럼 추가 (015에서 누락)
--   2. subsidy_draft_answers 테이블 — 사용자별 카드 입력값 저장
-- ============================================================

-- 1. cards_json 컬럼 추가 (015 마이그레이션에서 누락됨)
alter table subsidy_attachments
  add column if not exists cards_json jsonb;

-- 2. 사용자 작성 답변 저장 테이블
create table if not exists subsidy_draft_answers (
  id          bigserial primary key,
  user_id     uuid not null,
  program_id  bigint not null references subsidy_programs(id) on delete cascade,
  cards_json  jsonb not null default '[]',
  updated_at  timestamptz not null default now(),
  unique (user_id, program_id)
);

create index if not exists subsidy_draft_answers_user_idx
  on subsidy_draft_answers (user_id);

-- updated_at 자동 갱신 트리거
create or replace function _update_subsidy_draft_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subsidy_draft_answers_updated_at on subsidy_draft_answers;
create trigger subsidy_draft_answers_updated_at
  before update on subsidy_draft_answers
  for each row execute function _update_subsidy_draft_updated_at();

-- RLS: 본인 답변만 접근 가능
alter table subsidy_draft_answers enable row level security;

drop policy if exists "subsidy_draft_answers_owner" on subsidy_draft_answers;
create policy "subsidy_draft_answers_owner" on subsidy_draft_answers
  for all using (auth.uid() = user_id);
