-- 018_fix_subsidy_matches_fk.sql
-- subsidy_matches.program_id: text → bigint + FK to subsidy_programs(id)
-- (기존 데이터 없음 확인 후 적용)

-- 1. program_id 타입 변환 (text → bigint)
ALTER TABLE subsidy_matches
  ALTER COLUMN program_id TYPE bigint USING program_id::bigint;

-- 2. FK 제약 추가
ALTER TABLE subsidy_matches
  ADD CONSTRAINT fk_subsidy_matches_program
  FOREIGN KEY (program_id) REFERENCES subsidy_programs(id) ON DELETE CASCADE;

-- 3. (user_id, program_id) 복합 유니크 — UPSERT 기준키
ALTER TABLE subsidy_matches
  ADD CONSTRAINT uq_subsidy_matches_user_program
  UNIQUE (user_id, program_id);

COMMENT ON COLUMN subsidy_matches.program_id IS 'subsidy_programs.id (bigint PK) 참조 — external_id(text) 아님';
