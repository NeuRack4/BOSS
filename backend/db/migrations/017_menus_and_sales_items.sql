-- 017_menus_and_sales_items.sql
-- 메뉴 관리 + 메뉴별 매출 세분화

-- ── 1. menus 테이블 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('음료', '디저트', '기타')),
  price       INT,                        -- 기본 판매가 (원), null 허용
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)                  -- 같은 유저의 동일 메뉴명 중복 방지
);

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY menus_select ON menus FOR SELECT USING (user_id = auth.uid());
CREATE POLICY menus_insert ON menus FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY menus_update ON menus FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY menus_delete ON menus FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS menus_user_idx ON menus(user_id);

-- ── 2. sales_items 테이블 ──────────────────────────────────────
-- 영수증 한 장 = 여러 sales_items (메뉴별 1행)
CREATE TABLE IF NOT EXISTS sales_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_id     UUID REFERENCES menus(id) ON DELETE SET NULL,
  menu_name   TEXT NOT NULL,              -- 판매 시점 메뉴명 스냅샷
  date        DATE NOT NULL,
  quantity    INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  INT NOT NULL CHECK (unit_price >= 0),
  amount      INT NOT NULL CHECK (amount >= 0),  -- quantity * unit_price
  time_slot   TEXT CHECK (time_slot IN ('오전', '오후', '저녁')),
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ocr')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sales_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_items_select ON sales_items FOR SELECT USING (user_id = auth.uid());
CREATE POLICY sales_items_insert ON sales_items FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY sales_items_update ON sales_items FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY sales_items_delete ON sales_items FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS sales_items_user_date ON sales_items(user_id, date);
CREATE INDEX IF NOT EXISTS sales_items_menu_id   ON sales_items(menu_id);
