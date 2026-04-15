# 신규 기능 구현 계획

> 브랜치: `feature/insights-data-enrichment` | 기준일: 2026-04-15

---

## 개요

| Phase   | Step   | 기능                                  | 난이도 | 작업량 |
| ------- | ------ | ------------------------------------- | ------ | ------ |
| Phase 1 | Step 1 | 비용 관리 (월세·재료비·인건비)        | ⭐     | 2~3일  |
| Phase 1 | Step 2 | 마케팅 AI / SNS 콘텐츠 생성           | ⭐     | 2일    |
| Phase 1 | Step 3 | 정부 지원·대출 자동 매칭              | ⭐     | 1일    |
| Phase 2 | Step 4 | VLM 자동 등록 (영수증·메뉴판)         | ⭐⭐   | 3일    |
| Phase 2 | Step 5 | 메뉴 관리 + 메뉴판 VLM 분석           | ⭐⭐   | 2~3일  |
| Phase 2 | Step 6 | 매출 메뉴 세분화                      | ⭐⭐   | 3~4일  |
| Phase 3 | Step 7 | 지도 시각화 (상권별 매출·월세·순수익) | ⭐⭐⭐ | 4~5일  |
| Phase 3 | Step 8 | 창업 준비자 상권 추천                 | ⭐⭐⭐ | 4~5일  |
| Phase 3 | Step 9 | 메뉴별 매출 분석 → 추천 액션          | ⭐⭐⭐ | 2일+   |

### 의존성 구조

```
Phase 1
  Step 1 (비용 관리)
    └── Phase 3 Step 7 지도에서 "상권별 순수익" 표시 가능
    └── AI 인사이트에 비용·순수익 컨텍스트 추가

  Step 2 (마케팅 AI)     — 독립적, 선행 조건 없음
  Step 3 (지원 매칭)     — 독립적, 기존 subsidy API 재사용

Phase 2
  Step 4 (VLM 등록)
    └── Step 5 메뉴판 사진 → 자동 등록에 활용

  Step 5 (메뉴 관리)     — menus 테이블 생성
    └── Step 6 sales.menu_id → menus 테이블 참조

  Step 6 (매출 세분화)   — Step 5 완료 후
    └── Phase 3 Step 9 메뉴별 분석에 데이터 공급 (최소 1개월 축적 필요)

Phase 3
  Step 7 (지도)          — Step 1 완료 + 월세 데이터 수집 선행
    └── Step 8 지도 위에 창업 추천 레이어 추가

  Step 8 (창업 준비자)   — Step 7 완료 후
  Step 9 (메뉴별 분석)   — Step 6 데이터 1개월 이상 축적 후
```

---

## Phase 1 — 빠른 가치 (선행 조건 없음)

### Step 1. 비용 관리 (월세·재료비·인건비)

#### 목표

매출뿐 아니라 지출 항목도 입력·조회해 **순수익 = 매출 - 비용** 자동 계산

#### 현황

`founder_financials` 테이블에 `purchase_rent`, `purchase_ingredient`, `purchase_other` 컬럼이 이미 존재하나 프론트·API 미연결 상태.

#### DB 변경

```sql
-- migrations/015_expenses.sql
CREATE TABLE expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  amount      INT NOT NULL,          -- 원 단위
  category    TEXT NOT NULL,         -- 'rent' | 'ingredient' | 'labor' | 'utility' | 'other'
  memo        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenses_user ON expenses USING (user_id = auth.uid());
CREATE INDEX expenses_user_date ON expenses(user_id, date);
```

카테고리 정의:

| 값           | 표시명      |
| ------------ | ----------- |
| `rent`       | 월세·임대료 |
| `ingredient` | 재료비      |
| `labor`      | 인건비      |
| `utility`    | 공과금      |
| `other`      | 기타        |

#### 백엔드 변경

**신규 파일**: `backend/api/routers/expenses.py`

```
POST   /expenses/           — 비용 입력
GET    /expenses/           — 비용 목록 (날짜 필터)
GET    /expenses/summary    — 월별 비용 요약 + 순수익 계산
PUT    /expenses/{id}       — 수정
DELETE /expenses/{id}       — 삭제
```

`GET /expenses/summary` 응답 예시:

```json
{
  "year": 2026,
  "month": 4,
  "total_sales": 3500000,
  "total_expenses": 1800000,
  "net_profit": 1700000,
  "net_profit_margin": 48.6,
  "breakdown": {
    "rent": 800000,
    "ingredient": 600000,
    "labor": 300000,
    "utility": 100000
  }
}
```

`backend/api/main.py`에 `expenses` 라우터 등록

#### 프론트엔드 변경

**신규 페이지**: `frontend/app/dashboard/expenses/page.tsx`

- 비용 입력 폼 (날짜·금액·카테고리·메모)
- 비용 내역 리스트
- 카테고리별 합계

**기존 페이지 수정**:

- `frontend/app/dashboard/page.tsx` — 메인 대시보드에 순수익 카드 추가
- `frontend/app/dashboard/insights/page.tsx` — AI 분석 시 비용 컨텍스트 추가

**네비게이션**: 사이드바에 "비용 관리" 메뉴 추가

#### insights.py 수정

`/insights/analyze` 엔드포인트에서 비용 요약도 가져와 Claude 프롬프트에 주입:

```python
# 기존: 매출 데이터만
# 추가: 비용 데이터 + 순수익 계산
expense_summary = await get_expense_summary(user_id, year, month)
# 프롬프트에 "이번달 순수익: X원, 주요 비용: 월세 Y원" 형태로 추가
```

---

### Step 2. 마케팅 AI / SNS 콘텐츠 생성

#### 목표

AI 분석 결과를 바탕으로 **인스타그램·블로그 게시글 초안** 자동 생성

#### 신규 API

`POST /marketing/content` 엔드포인트:

```python
@router.post("/content")
async def generate_content(
    user_id: str,
    content_type: str,   # 'instagram' | 'blog' | 'event' | 'menu_highlight'
    target_menu: str = None,
    promotion: str = None
):
```

콘텐츠 타입별 생성 내용:

| 타입             | 생성 내용                         |
| ---------------- | --------------------------------- |
| `instagram`      | 인스타그램 캡션 + 해시태그 30개   |
| `blog`           | 네이버 블로그 포스팅 초안 (500자) |
| `event`          | 프로모션 이벤트 문구 (할인·쿠폰)  |
| `menu_highlight` | 신메뉴/추천메뉴 소개 게시글       |

Instagram 프롬프트 예시:

```python
INSTAGRAM_PROMPT = """
카페 정보: {cafe_name}, {area} 상권
이번달 인기 메뉴: {top_menu}
계절/날씨: {season_context}
특별 사항: {promotion}

인스타그램 게시글을 작성해줘:
1. 캡션 (감성적, 3~5문장)
2. 관련 해시태그 20~30개 (마포구·카페·메뉴명 포함)
3. 게시 최적 시간대 추천 (유동인구 데이터 기반)
"""
```

#### 신규 페이지: `frontend/app/dashboard/marketing/page.tsx`

```
┌─────────────────────────────────────────┐
│  마케팅 콘텐츠 생성                      │
│                                         │
│  [인스타그램] [블로그] [이벤트] [메뉴소개]│
│                                         │
│  강조할 메뉴: [아메리카노 ▼]            │
│  특별 내용:  [_________________]        │
│                                         │
│  [콘텐츠 생성]                          │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 오늘도 홍대 골목에서 한 잔 ☕    │   │
│  │ 바쁜 하루 중 잠깐의 여유...      │   │
│  │ #홍대카페 #마포카페 #아메리카노  │   │
│  └─────────────────────────────────┘   │
│  [복사하기]  [다시 생성]               │
└─────────────────────────────────────────┘
```

---

### Step 3. 정부 지원·대출 자동 매칭

#### 목표

창업 준비자 프로필 기반으로 `subsidy_programs` 테이블에서 적합 지원사업 자동 추천

#### 현황

`search_subsidies()` RPC 함수 + `subsidy_programs` 테이블 완성됨. 파라미터 조정만 필요.

#### 백엔드 변경

`backend/api/routers/subsidies.py`에 창업 준비자용 엔드포인트 추가:

```python
@router.get("/startup-match")
async def match_for_startup(
    capital: int,          # 보유 자본
    age: int = None,       # 나이 (청년 기준 39세 이하)
    is_first: bool = True  # 첫 창업 여부
):
    query = "마포구 카페 창업 지원사업"
    if age and age <= 39:
        query += " 청년창업"
    if capital < 50_000_000:
        query += " 소자본 창업"

    # 기존 search_subsidies() RPC 재사용
    results = await search_subsidies(query, match_count=10)
    return results
```

---

## Phase 2 — VLM + 메뉴 (Phase 1 완료 후)

### Step 4. VLM 자동 등록 (영수증·메뉴판)

#### 목표

사진 한 장으로 매출 또는 메뉴를 자동 등록 — **Claude Vision** 활용

#### 아키텍처

```
[사용자 사진 업로드]
        │
        ▼
[Supabase Storage 임시 저장]
        │
        ▼
[POST /ocr/receipt 또는 /ocr/menu]
        │
        ▼
[Claude Sonnet 4.6 Vision API]
  - 이미지 base64 인코딩
  - 구조화된 JSON 추출 프롬프트
        │
        ▼
[파싱된 데이터 반환 → 프론트에서 사용자 확인]
        │
        ▼
[확인 후 POST /sales/ 또는 /menus/ 로 저장]
```

#### 신규 파일: `backend/api/routers/ocr.py`

```
POST /ocr/receipt  — 영수증 사진 → 매출 데이터 추출
POST /ocr/menu     — 메뉴판 사진 → 메뉴 목록 추출
```

영수증 파싱 프롬프트:

```python
RECEIPT_PROMPT = """
이 영수증 이미지에서 다음 정보를 JSON으로 추출해줘:
- date: 날짜 (YYYY-MM-DD)
- items: [{ name, quantity, unit_price, amount }]
- total: 합계 금액

추출 불가능한 필드는 null로 반환.
"""
```

메뉴판 파싱 프롬프트:

```python
MENU_PROMPT = """
이 메뉴판 이미지에서 메뉴 목록을 JSON으로 추출해줘:
- items: [{ name, category, price, description }]
  - category: '음료' | '디저트' | '푸드' | '기타'

추출 불가능한 필드는 null로 반환.
"""
```

응답 예시 (영수증):

```json
{
  "date": "2026-04-15",
  "items": [
    {
      "name": "아메리카노",
      "quantity": 3,
      "unit_price": 4500,
      "amount": 13500
    },
    { "name": "카페라떼", "quantity": 2, "unit_price": 5500, "amount": 11000 }
  ],
  "total": 24500
}
```

#### 프론트엔드 변경

- 매출 입력 폼에 "영수증 사진으로 입력" 버튼 추가
- 메뉴 관리 페이지에 "메뉴판 사진으로 등록" 버튼 추가
- OCR 결과 미리보기 → 수정 후 확정 저장 UI

---

### Step 5. 메뉴 관리 + 메뉴판 VLM 분석

#### 목표

메뉴 DB 구축 → 메뉴판 사진으로 자동 등록 → AI 메뉴 구성 추천

#### DB 변경

```sql
-- migrations/016_menus.sql
CREATE TABLE menus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,  -- '음료' | '디저트' | '푸드' | '기타'
  price       INT NOT NULL,
  cost        INT,            -- 원가 (선택)
  is_active   BOOLEAN DEFAULT true,
  memo        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY menus_user ON menus USING (user_id = auth.uid());
```

#### 신규 API

```
POST   /menus/           — 메뉴 등록
GET    /menus/           — 메뉴 목록
PUT    /menus/{id}       — 수정
DELETE /menus/{id}       — 삭제
POST   /menus/recommend  — AI 메뉴 구성 추천
```

`POST /menus/recommend` 프롬프트:

```python
MENU_RECOMMEND_PROMPT = """
현재 메뉴 구성:
{menu_list}

마포구 {area} 상권 카페 평균 데이터:
{rag_context}

다음을 분석해줘:
1. 현재 메뉴 구성의 강점/약점
2. 가격 구간 최적화 제안
3. 추가 추천 메뉴 2~3가지 (상권 특성 반영)
4. 폐기 검토 메뉴 (매출 기여도 낮을 가능성)
"""
```

#### 신규 페이지: `frontend/app/dashboard/menus/page.tsx`

- 메뉴 목록 테이블 (이름·카테고리·가격·원가·마진율)
- "메뉴판 사진으로 등록" 버튼 (Step 4 VLM 연동)
- "AI 메뉴 추천" 버튼 → 마크다운 결과 표시

---

### Step 6. 매출 메뉴 세분화

#### 목표

음료·디저트·기타 대분류에서 **실제 메뉴명 단위** 매출 입력으로 세분화

#### 선행 조건

Step 5(menus 테이블) 완료 후 진행. `sales.menu_id`가 `menus` 테이블을 참조.

#### DB 변경

```sql
-- migrations/017_sales_menu.sql
ALTER TABLE sales ADD COLUMN menu_id   UUID REFERENCES menus(id);
ALTER TABLE sales ADD COLUMN quantity  INT DEFAULT 1;
ALTER TABLE sales ADD COLUMN unit_price INT;  -- 단가 (amount = unit_price * quantity)
```

#### 백엔드 변경

- `SaleCreate` 스키마에 `menu_id`, `quantity`, `unit_price` 추가 (선택 필드)
- `GET /sales/summary`에 메뉴별 매출 분해 추가
- `GET /sales/menu-breakdown?year=&month=` 엔드포인트 추가

#### 프론트엔드 변경

- 매출 입력 폼에 메뉴 선택 드롭다운 추가 (menus 테이블에서 로드)
- 메뉴 선택 시 단가 자동 입력
- insights 페이지에 메뉴별 매출 순위 차트 추가 (Recharts BarChart)

---

## Phase 3 — 지도 + 창업 준비자 (Phase 2 완료 + 데이터 축적 후)

### Step 7. 지도 시각화

#### 목표

마포구 9개 상권을 지도 위에 표시 — 상권별 **평균 월매출, 월세, 순수익, 생존율** 오버레이

#### 선행 조건

- Step 1(비용 관리) 완료 → 순수익 계산 가능
- 월세 데이터 수집 완료 (외부 CSV)

#### 지도 라이브러리

카카오맵 JavaScript SDK (무료 tier: 일 300,000건)

```
npm install @types/kakao.maps.d.ts
```

#### 마포구 상권 좌표 (하드코딩)

```typescript
// frontend/lib/constants/mapo-areas.ts
export const MAPO_AREAS = [
  { id: "hongdae", name: "홍대입구", lat: 37.5563, lng: 126.9236 },
  { id: "hapjeong", name: "합정", lat: 37.5496, lng: 126.9143 },
  { id: "yeonnam", name: "연남동", lat: 37.563, lng: 126.9254 },
  { id: "mangwon", name: "망원동", lat: 37.5558, lng: 126.9063 },
  { id: "gongdeok", name: "공덕", lat: 37.5448, lng: 126.9516 },
  { id: "seongsan", name: "성산동", lat: 37.5659, lng: 126.9181 },
  { id: "mapo", name: "마포대로", lat: 37.5391, lng: 126.9498 },
  { id: "ahyeon", name: "아현동", lat: 37.5508, lng: 126.9607 },
  { id: "sinsu", name: "신수동", lat: 37.5446, lng: 126.9384 },
];
```

#### 월세 데이터

**출처**: 서울시 상가임대차 실태조사 (공공데이터포털, 연 1회 CSV)

- 수집 스크립트: `backend/scripts/seed_rent_data.py`

```sql
-- migrations/018_rent_startup.sql
CREATE TABLE area_rent_stats (
  id           BIGSERIAL PRIMARY KEY,
  area_name    TEXT NOT NULL,
  year         INT,
  quarter      TEXT,
  avg_rent_m2  INT,      -- 월 임대료 (원/m²)
  avg_area_m2  NUMERIC,  -- 평균 면적 (m²)
  avg_rent     INT,      -- 평균 월세 (원)
  source       TEXT DEFAULT '서울시 상가임대차 실태조사'
);
```

#### 신규 API

```
GET /map/areas          — 9개 상권 기본 정보 + 좌표
GET /map/stats?area=    — 특정 상권 통계 (매출·월세·생존율)
GET /map/overview       — 전체 상권 비교 데이터 (지도 오버레이용)
```

#### 신규 페이지: `frontend/app/map/page.tsx`

```
┌─────────────────────────────────────────┐
│  마포구 카페 상권 지도                   │
│  [매출] [월세] [순수익] [생존율]  탭     │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  카카오맵                        │   │
│  │  ● 홍대입구  월평균 2,340만     │   │
│  │  ● 합정      월평균 1,870만     │   │
│  │  ● 연남동    월평균 2,100만     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  선택: 홍대입구                          │
│  ├ 평균 월매출: 2,340만원              │
│  ├ 평균 월세:   180만원               │
│  ├ 추정 순수익: 820만원               │
│  └ 카페 생존율: 96.9%                 │
└─────────────────────────────────────────┘
```

---

### Step 8. 창업 준비자 상권 추천

#### 목표

보유 자본 입력 → 진입 가능한 상권 추천 + 정부 지원/대출 매칭

#### 선행 조건

Step 7(지도) 완료 → 지도 위에 추천 레이어 추가

#### DB 변경

```sql
-- users 테이블 확장
ALTER TABLE users ADD COLUMN user_type        TEXT DEFAULT 'operating';
  -- 'operating' (운영 중) | 'preparing' (창업 준비)
ALTER TABLE users ADD COLUMN available_capital INT;  -- 보유 자본 (원)

-- 상권별 창업 초기비용 (seed_startup_cost.py로 수집)
CREATE TABLE area_startup_cost (
  area_name    TEXT PRIMARY KEY,
  avg_deposit  INT,  -- 평균 보증금
  avg_interior INT,  -- 평균 인테리어
  avg_equipment INT, -- 평균 기기
  avg_total    INT,  -- 평균 총 창업비용
  min_total    INT,  -- 최소 창업비용
  source       TEXT
);
```

**데이터 수집**: 소상공인시장진흥공단 창업비용 통계 + 부동산114 상가 시세

#### 추천 로직

```python
def recommend_areas(available_capital: int) -> list:
    """
    - 창업 비용 <= 보유 자본 * 0.8 (여유 자금 20% 확보)
    - 생존율, 월평균 매출, 경쟁 강도 기반 점수 산출
    - 상위 3개 상권 추천
    """
```

#### 신규 API

```
GET  /recommend/areas?capital=   — 자본 기준 상권 추천
POST /recommend/full-analysis    — 보유 자본 + 개인정보 기반 풀 분석
                                   (상권 추천 + 지원사업 매칭 + 대출 안내)
```

#### 신규 페이지: `frontend/app/startup/page.tsx`

```
┌─────────────────────────────────────────┐
│  창업 준비 시뮬레이터                    │
│                                         │
│  보유 자본: [_______ 원]                │
│  희망 상권: [전체 ▼]                   │
│  업력/나이: [______]                   │
│                                         │
│  [분석 시작]                            │
│                                         │
│  추천 상권 TOP 3                        │
│  1위 연남동   창업비용 4,200만  생존율 97%│
│  2위 망원동   창업비용 3,800만  생존율 96%│
│  3위 성산동   창업비용 3,200만  생존율 95%│
│                                         │
│  활용 가능한 정부 지원 3건               │
│  ├ 소상공인 창업지원금 최대 200만        │
│  ├ 서울시 청년창업 보증 대출             │
│  └ 마포구 특화 지원사업                 │
└─────────────────────────────────────────┘
```

---

### Step 9. 메뉴별 매출 분석 → 추천 액션

#### 목표

어떤 메뉴가 잘 팔리는지, 어떤 메뉴를 밀어야 하는지 AI가 분석

#### 선행 조건

- Step 5(menus 테이블) 완료
- Step 6(sales.menu_id 연결) 완료
- 최소 1개월 메뉴별 매출 데이터 축적

#### 백엔드 변경

`GET /insights/menu-analysis` 엔드포인트 추가:

```python
SELECT m.name, m.category, m.price,
       COUNT(s.id)    as order_count,
       SUM(s.amount)  as total_revenue,
       SUM(s.amount) / NULLIF(m.price, 0) as margin_contribution
FROM sales s JOIN menus m ON s.menu_id = m.id
WHERE s.user_id = :user_id
  AND DATE_TRUNC('month', s.date) = :month
GROUP BY m.id
ORDER BY total_revenue DESC
```

Claude 프롬프트 추가 컨텍스트:

- 상위 3개 메뉴 매출 집중도
- 카테고리별 매출 비중
- 마진 기여도 낮은 메뉴

#### 프론트엔드

- insights 페이지에 "메뉴별 매출" 탭 추가
- 메뉴 순위 막대 차트 (Recharts BarChart)
- AI 추천 액션에 구체적 메뉴명 포함

---

## 파일 변경 목록 (전체)

### 신규 파일

| 파일                                         | Step     | 역할                   |
| -------------------------------------------- | -------- | ---------------------- |
| `backend/api/routers/expenses.py`            | Step 1   | 비용 CRUD API          |
| `backend/api/routers/marketing.py`           | Step 2   | SNS 콘텐츠 생성        |
| `backend/api/routers/ocr.py`                 | Step 4   | VLM 영수증·메뉴판 파싱 |
| `backend/api/routers/menus.py`               | Step 5   | 메뉴 CRUD + AI 추천    |
| `backend/api/routers/map.py`                 | Step 7   | 지도 상권 데이터 API   |
| `backend/api/routers/recommend.py`           | Step 8   | 창업 준비자 상권 추천  |
| `backend/scripts/seed_rent_data.py`          | Step 7   | 월세 데이터 수집       |
| `backend/scripts/seed_startup_cost.py`       | Step 8   | 창업 초기비용 데이터   |
| `backend/db/migrations/015_expenses.sql`     | Step 1   | 비용 테이블            |
| `backend/db/migrations/016_menus.sql`        | Step 5   | 메뉴 테이블            |
| `backend/db/migrations/017_sales_menu.sql`   | Step 6   | sales 메뉴 세분화      |
| `backend/db/migrations/018_rent_startup.sql` | Step 7~8 | 월세·창업비용 테이블   |
| `frontend/app/dashboard/expenses/page.tsx`   | Step 1   | 비용 입력 페이지       |
| `frontend/app/dashboard/marketing/page.tsx`  | Step 2   | 마케팅 콘텐츠 페이지   |
| `frontend/app/dashboard/menus/page.tsx`      | Step 5   | 메뉴 관리 페이지       |
| `frontend/app/map/page.tsx`                  | Step 7   | 상권 지도 페이지       |
| `frontend/app/startup/page.tsx`              | Step 8   | 창업 준비 시뮬레이터   |
| `frontend/lib/constants/mapo-areas.ts`       | Step 7   | 마포구 상권 좌표       |

### 수정 파일

| 파일                                       | Step      | 변경 내용                        |
| ------------------------------------------ | --------- | -------------------------------- |
| `backend/api/main.py`                      | 전체      | 신규 라우터 등록                 |
| `backend/api/routers/insights.py`          | Step 1, 9 | 비용·메뉴 컨텍스트 추가          |
| `backend/api/routers/subsidies.py`         | Step 3    | 창업 준비자 매칭 엔드포인트 추가 |
| `frontend/app/dashboard/sales/page.tsx`    | Step 4, 6 | 메뉴 선택 + VLM 업로드 추가      |
| `frontend/app/dashboard/insights/page.tsx` | Step 1, 9 | 메뉴별 분석 탭 추가              |
| `frontend/app/dashboard/page.tsx`          | Step 1    | 순수익 카드 추가                 |

---

## 기술 스택 추가 사항

| 항목       | 내용                                          |
| ---------- | --------------------------------------------- |
| 지도       | 카카오맵 JavaScript SDK (무료 tier)           |
| VLM        | Claude Sonnet 4.6 Vision (기존 API 키 재사용) |
| SNS 콘텐츠 | Claude API (기존)                             |
| 매출 예측  | 추후 Prophet (Step 9 이후 검토)               |
