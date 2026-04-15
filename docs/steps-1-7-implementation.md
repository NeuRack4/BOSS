# Steps 1–7 구현 완료 정리

> 브랜치: `feature/insights-data-enrichment`
> 기준일: 2026-04-14

---

## 구현 요약

| Step | 항목                               | 상태 | 데이터 규모             |
| ---- | ---------------------------------- | ---- | ----------------------- |
| 1    | 2024년 최신 분기 수집 (mapo_stats) | ✅   | 20241~20244, 각 72청크  |
| 2    | 상권변화지표 CSV 파싱              | ✅   | HH/HL/LH/LL 등급 데이터 |
| 3    | 유동인구 API 수집                  | ✅   | 13개 분기, 5,824청크    |
| 4    | 공휴일 데이터                      | ✅   | 2021~2025, 106개 (정적) |
| 5    | 날씨 데이터 수집                   | ✅   | 2021~현재, 1,929건      |
| 6    | 전략 가이드 RAG                    | ✅   | 4개 PDF, 144청크        |
| 7    | 벤치마킹 기능                      | ✅   | 32개 상권 비교          |

---

## Phase 1 — 데이터 수집

### Step 1. 2024년 최신 분기 수집

**파일**: `backend/scripts/seed_mapo_stats.py`

**Supabase 현황** (documents 테이블, category='mapo_stats'):

- 총 청크: ~639개 (2021Q4~2024Q4)
- 2024년 분기: 20241~20244, 각 72청크 (총 288개)

**수동 재실행 방법**:

```bash
python -m backend.scripts.seed_mapo_stats 20241 20242 20243 20244
```

---

### Step 2. 상권변화지표 CSV 파싱

**파일**:

- `backend/data/parsers/commercial_change_parser.py`
- `backend/scripts/seed_commercial_change.py`
- `backend/data/seeds/commercial_change/서울시 상권분석서비스(상권변화지표-상권).csv`

**HH/HL/LH/LL 의미**:
| 코드 | 의미 |
|------|------|
| HH | 매출·유동인구 모두 높음 (핵심 상권) |
| HL | 매출 높음, 유동인구 낮음 (목적형 상권) |
| LH | 매출 낮음, 유동인구 높음 (경쟁 과열) |
| LL | 매출·유동인구 모두 낮음 (침체 상권) |

**수동 재실행 방법**:

```bash
python -m backend.scripts.seed_commercial_change
```

---

### Step 3. 유동인구 데이터 수집

**파일**: `backend/scripts/seed_mapo_population.py`

**수집 범위**: 2021Q4 ~ 2024Q4 (13개 분기)
**데이터**: 5,824청크 (마포구 행정동별 시간대·요일·연령대별 유동인구)

**수동 재실행 방법**:

```bash
# 전체 분기
python -m backend.scripts.seed_mapo_population --all

# 특정 분기
python -m backend.scripts.seed_mapo_population 20244
```

---

### Step 4. 공휴일 데이터

**파일**:

- `backend/data/seeds/holidays.json` — 2021~2025년 공휴일 106개
- `backend/core/holidays.py` — 유틸 함수 4개

**사용 가능한 함수**:

```python
from backend.core.holidays import (
    is_holiday,           # is_holiday("2025-01-01") → True
    get_holiday_name,     # get_holiday_name("2025-01-01") → "신정"
    get_month_holidays,   # get_month_holidays(2025, 5) → {"20250505": "어린이날", ...}
    get_holiday_context,  # get_holiday_context("2025-05-05") → "어린이날(공휴일)"
)
```

> ⚠️ **현재 한계**: holidays.json이 2025년까지만 있어 2026년 공휴일 미반영

---

### Step 5. 날씨 데이터 수집

**파일**:

- `backend/data/crawlers/weather_crawler.py` — 기상청 ASOS API
- `backend/scripts/seed_weather.py` — 과거 날씨 일괄 수집
- Supabase `weather_data` 테이블 (migration: `010_weather.sql`)

**수집 현황**: 2021-01-01 ~ 현재, 1,929건

**weather_data 테이블 컬럼**:
| 컬럼 | 설명 |
|------|------|
| date | 날짜 |
| avg_temp | 평균기온 (℃) |
| rain_mm | 강수량 (mm) |
| is_rainy | 강수 여부 (자동 계산) |
| max_wind | 최대풍속 (m/s) |
| avg_humid | 평균습도 (%) |

**수동 재실행 방법**:

```bash
# 과거 전체 수집 (2021~어제)
python -m backend.scripts.seed_weather

# 특정 기간
python -m backend.scripts.seed_weather --start 2024-01-01 --end 2024-12-31
```

> ⚠️ **현재 한계**: APScheduler에 일일 자동 수집 미등록 (수동 실행 필요)

---

### Step 6. 전략 가이드 RAG

**파일**:

- `docs/strategy/` — 소상공인시장진흥공단 상권분석과창업 시리즈 PDF 4개
- `backend/scripts/seed_strategy.py` — PDF 파싱 + 청킹 + 임베딩

**수집 현황**: 4개 PDF → 144청크 (category='strategy')

**수동 재실행 방법**:

```bash
python -m backend.scripts.seed_strategy
```

**PDF 추가 방법**: `docs/strategy/` 폴더에 PDF 넣고 재실행

---

## Phase 2 — 기능 개선

### Step 7. 벤치마킹 기능

**파일**:

- `backend/api/routers/insights.py` — 2개 엔드포인트 추가
- `frontend/app/dashboard/insights/page.tsx` — 벤치마킹 카드 추가

**새 API 엔드포인트**:

#### `GET /insights/areas`

상권 목록 반환 (32개)

**응답 예시**:

```json
{
  "areas": ["KB국민은행 망원동지점", "공덕동주민센터", "홍대입구역(홍대)", ...]
}
```

#### `GET /insights/benchmark`

내 카페 vs 상권 평균 비교

**파라미터**:
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| user_id | string | 사용자 UUID |
| area | string | 상권명 (예: `홍대입구역(홍대)`) |
| year | int | 비교 연도 |
| month | int | 비교 월 |

**응답 예시**:

```json
{
  "area": "홍대입구역(홍대)",
  "quarter": "20244",
  "user_monthly": 3500000,
  "area_avg_per_store": 2800000,
  "area_total_monthly": 1209946142,
  "store_count": 285,
  "ratio_pct": 125.0,
  "diff": 700000
}
```

**ratio_pct 해석**:

- `100%` = 상권 평균과 동일
- `125%` = 상권 평균보다 25% 높음
- `80%` = 상권 평균보다 20% 낮음

---

## AI 인사이트 개선 (insights.py)

Steps 4·5·6 데이터가 Claude 프롬프트에 자동 주입됩니다.

**프롬프트 컨텍스트 구성**:

```
[2026년 4월 매출 현황]
- 이번달 총 매출: ...
- 전달 대비: ...

[카테고리별 매출] ...
[시간대별 매출] ...

[공휴일 정보] 4월 공휴일: 10일 부처님오신날   ← Step 4
[날씨 정보] 2026년 4월                         ← Step 5
- 강수일: 8일 / 맑은 날: 22일 / 평균기온: 14.2°C
- 비 온 날 평균 매출: 89,000원
- 맑은 날 평균 매출: 115,000원

[마포구 상권 참고 데이터] ...                  ← Step 1~3 RAG
[소상공인 경영 전략 가이드] ...                ← Step 6 RAG
```

---

## 프론트엔드 테스트 방법

### 사전 조건

- 백엔드 서버 실행: `uvicorn backend.api.main:app --reload`
- 프론트엔드 서버 실행: `npm run dev` (frontend/ 폴더에서)
- Supabase 로그인 상태

### 테스트 1. 벤치마킹 (매출 데이터 없이도 가능)

1. `/dashboard/insights` 접속
2. 연도/월 선택
3. **상권 드롭다운에서 상권 선택** (예: `홍대입구역(홍대)`)
4. **"비교하기"** 클릭
5. 확인 항목:
   - 상권 평균 매출 표시 여부
   - 바 차트 렌더링
   - 분기 정보 표시 (예: `2024년 4분기 기준`)

> 매출 데이터가 없으면 "내 카페 0원" 으로 표시됩니다.
> `/dashboard/sales`에서 매출 입력 후 재시도하면 실제 비교 가능합니다.

### 테스트 2. AI 인사이트 (매출 데이터 필요)

1. `/dashboard/sales`에서 이번달 매출 입력 (금액·카테고리·시간대)
2. `/dashboard/insights` 접속
3. 연도/월 선택 후 **"✦ AI 분석 시작"** 클릭
4. 확인 항목:
   - 매출 요약 카드 4개 표시
   - AI 분석 텍스트 (마포구 통계 수치 인용 여부)
   - `마포구 실데이터 반영` 배지 표시 여부
   - `날씨 반영` 배지 표시 여부

### 테스트 3. API 직접 호출

백엔드 서버 실행 후 브라우저에서 직접 확인:

```
# 상권 목록
http://localhost:8000/insights/areas

# 벤치마킹 (user_id는 Supabase Auth 사용자 UUID)
http://localhost:8000/insights/benchmark?user_id=<UUID>&area=홍대입구역(홍대)&year=2026&month=4

# API 문서 (Swagger)
http://localhost:8000/docs
```

---

## 현재 알려진 한계

| 항목                           | 내용                                          |
| ------------------------------ | --------------------------------------------- |
| 공휴일 2026년 누락             | holidays.json이 2025년까지만 있음             |
| 날씨 자동 수집 미등록          | scheduler.py에 일일 job 없음 — 수동 실행 필요 |
| 벤치마킹 RadialBarChart 미적용 | 기획서 명시 사항 — 수평 바로 대체 구현        |
