# 기능 9·10번 구현 현황 — 매출관리 & 데이터 분석

> 기준일: 2026-04-13 | 브랜치: feature/sales-data-layer

---

## 개요

| 기능 | 구현률 | 비고 |
|---|---|---|
| 9. 매출관리 (ERP) | 80% | sales 테이블 마이그레이션 누락 |
| 10. 데이터 분석 및 통찰력 | 70% | 외부 데이터(유동인구·날씨) 미연동 |

---

## ✅ 완료된 부분

### 백엔드 API

#### `backend/api/routers/sales.py`
- `POST /sales/` — 매출 신규 생성
- `GET /sales/` — 매출 조회 (날짜 범위 필터)
- `PUT /sales/{sale_id}` — 매출 수정
- `DELETE /sales/{sale_id}` — 매출 삭제
- `GET /sales/summary` — 월별 매출 요약
  - 현월 총액, 전달 대비 %, 거래 건수, 일 평균 매출
  - 전년 동월 비교
  - 카테고리별 매출 분포 (음료 / 디저트 / 기타)
  - 시간대별 매출 분포 (오전 / 오후 / 저녁)

#### `backend/api/routers/insights.py`
- `POST /insights/analyze` — AI 인사이트 분석
  - 매출 데이터 + RAG(마포구 카페 통계) + Claude Sonnet 4.6 → 원인 분석 및 액션 제안
  - 매출 변화 감지 시 `trigger_log` 자동 생성 (Proactive 트리거)
  - 매출 하락 (≤-10%) → 하락 전략 RAG 쿼리 자동 분기
  - 매출 상승 (≥+10%) → 상승 전략 RAG 쿼리 자동 분기

**RAG 쿼리 동적 생성 로직:**
```
기본:    "마포구 카페 {월} 매출 계절 패턴"
하락 시: "카페 매출 하락 원인 회복 전략", "마포구 카페 비수기 대응"
상승 시: "카페 매출 상승 유지 전략", "마포구 카페 성수기 매출 확대"
안정 시: "마포구 카페 매출 안정 유지 전략"
```

### 백엔드 스키마

#### `backend/api/schemas/sale.py`
```python
SaleCreate:   date, amount, category(음료/디저트/기타), time_slot(오전/오후/저녁), memo
SaleResponse: id, user_id, date, amount, category, time_slot, memo, created_at
SaleUpdate:   모든 필드 선택적 (부분 수정 지원)
SalesSummary: total_amount, by_category, by_time_slot, peak_time_slot, record_count
```

### 프론트엔드

#### `frontend/app/dashboard/page.tsx` — 대시보드 메인
- 4개 주요 지표 카드 (이번달 매출 / 전달 대비 % / 거래 건수 / 일 평균 매출)
- 전년 동월 비교 섹션
- 일별 매출 차트 (Recharts BarChart)
- 빠른 이동 버튼 (매출 입력, AI 분석)

#### `frontend/app/dashboard/sales/page.tsx` — 매출 관리
- 매출 입력 폼 (날짜 / 금액 / 카테고리 / 시간대 / 메모)
- 신규 입력 & 수정 모드 토글
- 매출 내역 목록 (최근 50건, 날짜 역순)
- 수정 / 삭제 버튼
- 실시간 합계 표시

#### `frontend/app/dashboard/insights/page.tsx` — AI 인사이트
- 분석 기간 선택 (연도 / 월 드롭다운)
- AI 분석 시작 버튼
- 로딩 상태 ("Claude가 마포구 카페 데이터를 분석하고 있습니다...")
- 분석 결과 표시
  - 4개 요약 카드
  - AI 분석 텍스트 (마포구 실데이터 반영 배지)
  - 카테고리별 매출 프로그레스 바
  - 시간대별 매출 프로그레스 바

### RAG 파이프라인

#### `backend/rag/ingest.py` + `backend/rag/retriever/pgvector_retriever.py`
- BGE-M3 임베딩 (1024차원) → Supabase pgvector 저장
- 코사인 유사도 검색 (`match_documents` RPC)
- 카테고리 필터 지원 (`mapo_stats` 카테고리로 인사이트 검색)

#### 마포구 상권 데이터 (오늘 수집 완료)
- 639개 청크 저장 (9개 분기: 2021Q4 ~ 2023Q4)
- 추정매출 (월 매출, 요일별, 시간대별)
- 점포현황 (점포수, 개업률, 폐업률, 생존율)

---

## ❌ 부족한 부분

### 🔴 1순위 — 앱 동작에 필수

#### `sales` 테이블 마이그레이션 파일 없음
`backend/api/routers/sales.py`에서 `supabase.table("sales")`에 접근하지만 마이그레이션 파일이 없습니다.

필요한 SQL:
```sql
create table if not exists sales (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade,
  date       date not null,
  amount     int not null,
  category   text not null check (category in ('음료', '디저트', '기타')),
  time_slot  text not null check (time_slot in ('오전', '오후', '저녁')),
  memo       text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table sales enable row level security;

create policy "sales_own" on sales
  for all using (auth.uid() = user_id);

create index if not exists idx_sales_user_date
  on sales (user_id, date);
```

### 🟡 2순위 — 기능 완성도

| 없는 기능 | 설명 | 영향 |
|---|---|---|
| POS / 카드사 자동 연동 | 현재 수동 입력만 가능 | 편의성 |
| 유동인구 데이터 연계 | 인사이트 분석에 미반영 | 분석 정확도 |
| 날씨 데이터 | "비 오는 날 매출 높음" 분석 불가 | 분석 정확도 |
| 공휴일 데이터 | 공휴일 매출 패턴 분석 불가 | 분석 정확도 |
| 월·분기·연간 차트 | 현재 월 단위만 존재 | 시각화 |
| 매출 예측 | 다음달 예상 매출 기능 없음 | 예측 기능 |
| 상권변화지표 | API 500 오류로 수집 불가 | 분석 깊이 |

### 🟢 3순위 — 고도화 (향후)

| 기능 | 설명 |
|---|---|
| 매출 이상치 탐지 | 비정상 거래 자동 감지 |
| 프로모션 효과 A/B 테스트 | 이벤트 전후 매출 비교 |
| 메뉴별 마진율 분석 | 카테고리를 메뉴 단위로 세분화 |
| 매출 예측 모델 | 선형회귀 or Prophet 기반 다음달 예측 |

---

## 파일 위치 정리

| 항목 | 경로 |
|---|---|
| 매출 API | `backend/api/routers/sales.py` |
| 인사이트 API | `backend/api/routers/insights.py` |
| 매출 스키마 | `backend/api/schemas/sale.py` |
| 대시보드 메인 | `frontend/app/dashboard/page.tsx` |
| 매출 관리 페이지 | `frontend/app/dashboard/sales/page.tsx` |
| AI 인사이트 페이지 | `frontend/app/dashboard/insights/page.tsx` |
| 대시보드 레이아웃 | `frontend/app/dashboard/layout.tsx` |
| RAG 수집 | `backend/rag/ingest.py` |
| RAG 검색 | `backend/rag/retriever/pgvector_retriever.py` |
| 마포구 데이터 수집 | `backend/scripts/seed_mapo_stats.py` |
| 상권 크롤러 | `backend/data/crawlers/seoul_alley.py` |

---

## 다음 작업 순서 (권장)

1. `backend/db/migrations/004_sales.sql` 작성 및 Supabase 적용
2. 유동인구 API (`VwsmAdstrdFlpopW`) 수집 추가
3. 날씨 API (기상청) 연동
4. 월·분기·연간 차트 UI 추가
