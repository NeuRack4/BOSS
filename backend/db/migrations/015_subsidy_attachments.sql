-- ============================================================
-- 지원사업 공고 첨부파일 (신청서 초안 기능)
--
-- 목적:
--   - bizinfo 상세 페이지에서 수집한 HWP/PDF 첨부파일 메타데이터 저장
--   - Supabase Storage 경로 추적
--   - 추출된 원문 텍스트 캐싱 (LLM 재호출 방지)
-- ============================================================

create table if not exists subsidy_attachments (
  id            bigserial primary key,
  program_id    bigint not null references subsidy_programs(id) on delete cascade,
  filename      text not null,
  file_type     text not null,                       -- 'hwp' | 'pdf' | 'docx'
  storage_path  text,                                -- supabase storage: subsidy-attachments/{external_id}/{filename}
  download_url  text,                                -- 원본 다운로드 URL
  raw_text      text,                                -- hwp5txt / pdfplumber 추출 텍스트
  parse_status  text not null default 'pending',     -- 'pending' | 'ok' | 'failed'
  fetched_at    timestamptz not null default now(),
  unique (program_id, filename)
);

create index if not exists subsidy_attachments_program_idx
  on subsidy_attachments (program_id);

create index if not exists subsidy_attachments_status_idx
  on subsidy_attachments (parse_status);

-- RLS: 공고 첨부파일은 로그인/익명 모두 읽기 허용, 쓰기는 service_role
alter table subsidy_attachments enable row level security;

drop policy if exists "subsidy_attachments_read" on subsidy_attachments;
create policy "subsidy_attachments_read" on subsidy_attachments
  for select using (true);
