-- ============================================================
-- 창업자 재무 데이터 + 사업자 정보 테이블
-- 세금 신고서 초안 생성을 위한 월별 매출/매입 데이터
-- ============================================================

-- 1. 월별 재무 데이터
create table if not exists founder_financials (
  id                    bigserial primary key,
  user_id               uuid references users(id) on delete cascade,
  year                  int not null,
  month                 int not null check (month between 1 and 12),

  -- 매출 (공급가액, 원)
  sales_card            bigint not null default 0,   -- 신용카드·현금영수증 매출
  sales_cash            bigint not null default 0,   -- 현금 매출 (영수증 미발행)
  sales_delivery        bigint not null default 0,   -- 배달앱 매출 (배민·쿠팡이츠 등)
  sales_tax_invoice     bigint not null default 0,   -- 세금계산서 발급 매출

  -- 매입 (공급가액, 원)
  purchase_ingredient   bigint not null default 0,   -- 원재료·소모품
  purchase_rent         bigint not null default 0,   -- 임대료
  purchase_other        bigint not null default 0,   -- 기타 비용
  purchase_tax_invoice  bigint not null default 0,   -- 세금계산서 수취 금액 합계

  created_at            timestamptz default now(),
  unique (user_id, year, month)
);

-- 2. 사업자 기본 정보 (세금 신고용)
create table if not exists founder_business_info (
  id              bigserial primary key,
  user_id         uuid references users(id) on delete cascade unique,
  business_name   text not null default '',     -- 상호
  business_number text not null default '',     -- 사업자등록번호 (xxx-xx-xxxxx)
  owner_name      text not null default '',     -- 대표자명
  address         text not null default '',     -- 사업장 주소
  tax_type        text not null default 'simplified'
                    check (tax_type in ('simplified', 'general')),
  -- simplified: 간이과세자 (연매출 8천만원 미만)
  -- general   : 일반과세자

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 3. drafts 테이블에 tax_deadline_id 컬럼 추가 (기존 tax agent 호환)
alter table drafts
  add column if not exists tax_deadline_id bigint references tax_deadlines(id) on delete set null;

-- 4. RLS
alter table founder_financials    enable row level security;
alter table founder_business_info enable row level security;

create policy "financials_own" on founder_financials
  for all using (auth.uid() = user_id);

create policy "business_info_own" on founder_business_info
  for all using (auth.uid() = user_id);
