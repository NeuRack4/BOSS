-- ============================================================
-- BOSS DB 마이그레이션 002 — 세금 기한 스케줄링
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. 세금 기한 마스터 테이블
create table if not exists tax_deadlines (
  id            bigserial primary key,
  tax_type      text not null,   -- vat | income | withholding | insurance
  title         text not null,
  deadline_date date not null,
  year          int  not null,
  description   text,
  source_url    text,
  created_at    timestamptz default now(),
  unique (tax_type, deadline_date, year)
);

-- 2. 사용자별 알림 발송 상태 추적 (중복 방지)
create table if not exists tax_notifications (
  id                bigserial primary key,
  user_id           uuid references users(id) on delete cascade,
  tax_deadline_id   bigint references tax_deadlines(id) on delete cascade,
  notified_at_d30   timestamptz,
  notified_at_d14   timestamptz,
  notified_at_d7    timestamptz,
  notified_at_d3    timestamptz,
  unique (user_id, tax_deadline_id)
);

-- 3. drafts 테이블에 세금 기한 참조 컬럼 추가
alter table drafts
  add column if not exists tax_deadline_id bigint references tax_deadlines(id);

-- ============================================================
-- RLS
-- ============================================================

alter table tax_deadlines     enable row level security;
alter table tax_notifications enable row level security;

-- tax_deadlines: 인증된 사용자는 모두 읽기 가능 (공용 마스터 데이터)
create policy "tax_deadlines_read_all" on tax_deadlines
  for select using (auth.role() = 'authenticated');

-- tax_notifications: 본인 것만 접근 가능
create policy "tax_notifications_own" on tax_notifications
  for all using (auth.uid() = user_id);
