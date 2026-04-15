-- 비용 관리 테이블
-- 월세·재료비·인건비 등 지출 항목 입력 → 순수익 계산용

CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  amount      INT NOT NULL CHECK (amount > 0),
  category    TEXT NOT NULL CHECK (category IN ('rent', 'ingredient', 'labor', 'utility', 'other')),
  memo        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY expenses_user_select ON expenses FOR SELECT USING (user_id = auth.uid());
CREATE POLICY expenses_user_insert ON expenses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY expenses_user_update ON expenses FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY expenses_user_delete ON expenses FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS expenses_user_date ON expenses(user_id, date);
