-- 019_founder_financials.sql
-- founder_business_info + founder_financials 테이블 생성
-- founder_financials는 sales/expenses INSERT·UPDATE·DELETE 시 자동 재집계 (B안)

-- ──────────────────────────────────────────
-- 1. founder_business_info (세금 신고용 사업자 정보)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS founder_business_info (
  id              bigserial PRIMARY KEY,
  user_id         uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name   text,
  business_number text,
  owner_name      text,
  address         text,
  tax_type        text NOT NULL DEFAULT 'simplified'
                  CHECK (tax_type IN ('simplified', 'general')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE founder_business_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 데이터만" ON founder_business_info
  FOR ALL USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- 2. founder_financials (월별 집계 — sales + expenses 자동 sync)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS founder_financials (
  id                  bigserial PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year                int  NOT NULL,
  month               int  NOT NULL CHECK (month BETWEEN 1 AND 12),

  -- 매출 (sales.category 기준)
  sales_card          bigint NOT NULL DEFAULT 0,  -- 신용카드·현금영수증
  sales_cash          bigint NOT NULL DEFAULT 0,  -- 현금 (미발행)
  sales_delivery      bigint NOT NULL DEFAULT 0,  -- 배달앱 (배민·쿠팡이츠)
  sales_tax_invoice   bigint NOT NULL DEFAULT 0,  -- 세금계산서 발급

  -- 지출 (expenses.category 기준)
  purchase_rent       bigint NOT NULL DEFAULT 0,  -- 임대료
  purchase_ingredient bigint NOT NULL DEFAULT 0,  -- 원재료·소모품
  purchase_labor      bigint NOT NULL DEFAULT 0,  -- 인건비
  purchase_utility    bigint NOT NULL DEFAULT 0,  -- 공과금
  purchase_other      bigint NOT NULL DEFAULT 0,  -- 기타

  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, year, month)
);

ALTER TABLE founder_financials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 데이터만" ON founder_financials
  FOR ALL USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- 3. 내부 헬퍼: 특정 user/year/month 재집계 후 UPSERT
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION _upsert_financials_for_month(
  p_user_id uuid,
  p_year    int,
  p_month   int
) RETURNS void AS $$
BEGIN
  INSERT INTO founder_financials (
    user_id, year, month,
    sales_card, sales_cash, sales_delivery, sales_tax_invoice,
    purchase_rent, purchase_ingredient, purchase_labor, purchase_utility, purchase_other,
    updated_at
  )
  VALUES (
    p_user_id, p_year, p_month,

    -- sales 집계
    COALESCE((
      SELECT SUM(amount) FROM sales
      WHERE user_id = p_user_id
        AND EXTRACT(YEAR  FROM date) = p_year
        AND EXTRACT(MONTH FROM date) = p_month
        AND category = 'card'
    ), 0),
    COALESCE((
      SELECT SUM(amount) FROM sales
      WHERE user_id = p_user_id
        AND EXTRACT(YEAR  FROM date) = p_year
        AND EXTRACT(MONTH FROM date) = p_month
        AND category = 'cash'
    ), 0),
    COALESCE((
      SELECT SUM(amount) FROM sales
      WHERE user_id = p_user_id
        AND EXTRACT(YEAR  FROM date) = p_year
        AND EXTRACT(MONTH FROM date) = p_month
        AND category = 'delivery'
    ), 0),
    COALESCE((
      SELECT SUM(amount) FROM sales
      WHERE user_id = p_user_id
        AND EXTRACT(YEAR  FROM date) = p_year
        AND EXTRACT(MONTH FROM date) = p_month
        AND category = 'tax_invoice'
    ), 0),

    -- expenses 집계
    COALESCE((
      SELECT SUM(amount) FROM expenses
      WHERE user_id = p_user_id
        AND EXTRACT(YEAR  FROM date) = p_year
        AND EXTRACT(MONTH FROM date) = p_month
        AND category = 'rent'
    ), 0),
    COALESCE((
      SELECT SUM(amount) FROM expenses
      WHERE user_id = p_user_id
        AND EXTRACT(YEAR  FROM date) = p_year
        AND EXTRACT(MONTH FROM date) = p_month
        AND category = 'ingredient'
    ), 0),
    COALESCE((
      SELECT SUM(amount) FROM expenses
      WHERE user_id = p_user_id
        AND EXTRACT(YEAR  FROM date) = p_year
        AND EXTRACT(MONTH FROM date) = p_month
        AND category = 'labor'
    ), 0),
    COALESCE((
      SELECT SUM(amount) FROM expenses
      WHERE user_id = p_user_id
        AND EXTRACT(YEAR  FROM date) = p_year
        AND EXTRACT(MONTH FROM date) = p_month
        AND category = 'utility'
    ), 0),
    COALESCE((
      SELECT SUM(amount) FROM expenses
      WHERE user_id = p_user_id
        AND EXTRACT(YEAR  FROM date) = p_year
        AND EXTRACT(MONTH FROM date) = p_month
        AND category = 'other'
    ), 0),

    now()
  )
  ON CONFLICT (user_id, year, month) DO UPDATE SET
    sales_card          = EXCLUDED.sales_card,
    sales_cash          = EXCLUDED.sales_cash,
    sales_delivery      = EXCLUDED.sales_delivery,
    sales_tax_invoice   = EXCLUDED.sales_tax_invoice,
    purchase_rent       = EXCLUDED.purchase_rent,
    purchase_ingredient = EXCLUDED.purchase_ingredient,
    purchase_labor      = EXCLUDED.purchase_labor,
    purchase_utility    = EXCLUDED.purchase_utility,
    purchase_other      = EXCLUDED.purchase_other,
    updated_at          = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────
-- 4. 트리거 함수: sales / expenses 변경 시 호출
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_founder_financials()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id   uuid;
  v_year      int;
  v_month     int;
  v_old_year  int;
  v_old_month int;
BEGIN
  -- 영향받은 행의 user/year/month 결정
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_year    := EXTRACT(YEAR  FROM OLD.date)::int;
    v_month   := EXTRACT(MONTH FROM OLD.date)::int;
  ELSE
    v_user_id := NEW.user_id;
    v_year    := EXTRACT(YEAR  FROM NEW.date)::int;
    v_month   := EXTRACT(MONTH FROM NEW.date)::int;
  END IF;

  -- 현재 달 재집계
  PERFORM _upsert_financials_for_month(v_user_id, v_year, v_month);

  -- UPDATE로 날짜가 다른 달로 이동한 경우 이전 달도 재집계
  IF TG_OP = 'UPDATE' THEN
    v_old_year  := EXTRACT(YEAR  FROM OLD.date)::int;
    v_old_month := EXTRACT(MONTH FROM OLD.date)::int;
    IF v_old_year != v_year OR v_old_month != v_month THEN
      PERFORM _upsert_financials_for_month(OLD.user_id, v_old_year, v_old_month);
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────
-- 5. 트리거 등록
-- ──────────────────────────────────────────
CREATE TRIGGER trg_sales_sync_financials
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION sync_founder_financials();

CREATE TRIGGER trg_expenses_sync_financials
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION sync_founder_financials();
