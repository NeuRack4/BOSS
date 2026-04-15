# CLAUDE.md

Claude Code가 이 레포지토리에서 작업할 때 참고하는 가이드입니다.

---

## 프로젝트 개요

**BOSS (Business Operations Support System)**
서울 F&B 소상공인(카페/베이커리/분식)을 위한 Proactive AI 비서.
창업자가 요청하지 않아도 에이전트가 먼저 초안을 준비한다.

### 핵심 개념

- **Proactive**: 사용자가 물어보기 전에 에이전트가 먼저 행동
- **항상 초안이 먼저**: 서류/신청서/공고는 항상 초안 상태로 전달, 창업자는 검토 후 제출만
- **상태머신 기반**: 창업자의 단계(셋업→초기운영→성장)를 추적하며 적절한 시점에 트리거

---

## 타겟 스코프

- **대상**: 서울 마포구에서 처음 카페 창업하는 1인 소상공인
- **업종**: 카페 (v0.x 단일 업종 — 베이커리/분식은 v2.0 이후)
- **지역**: 서울 마포구 한정 (홍대입구·합정·연남동·망원동·공덕·성산동·마포대로·아현동·신수동 9개 상권)
- **기간**: 창업 결심 ~ 오픈 후 1년

> **스코프 원칙**: 마포구 카페에만 집중. 전국/다업종 확장은 v2.0 이후.

---

## 기술 스택

### AI / LLM

- **메인 LLM**: Claude API (`claude-sonnet-4-6`) — 초안 생성, 추론 기반 트리거, 법령 브리프 요약
- **보조 LLM**: Google Gemini (`backend/agents/gemini.py`) — 실험적 에이전트 통합
- **멀티에이전트**: LangGraph — 상태머신 + 에이전트 오케스트레이션
- **RAG 파이프라인**: LangChain + LlamaIndex

### RAG / 임베딩 / 검색

- **벡터 DB**: Supabase pgvector (유료 플랜 내장 — ChromaDB 사용 안 함)
- **임베딩 모델**: `BAAI/bge-m3` (1024차원, 로컬 GPU/CPU — sentence-transformers)
- **폴백 임베딩**: OpenAI `text-embedding-3-small` (1536차원)
- **하이브리드 검색 (3-way RRF)**: 벡터 유사도 + FTS(`simple` 토크나이저) + `pg_trgm` word_similarity
  - HNSW 인덱스 (`m=16, ef_construction=64`) — 카테고리 pre-filter 안정성
  - trigram GIN 인덱스 (`gin_trgm_ops`) — 한국어 복합어 대응
  - `min_score=0.3`(벡터), `min_trgm_score=0.5`(트라이그램), `min_content_len=40`(제목-only 제외)
  - 응답 컬럼: `score`(RRF 정렬용) + `similarity`(사용자 표시용 코사인 %)

### 데이터베이스 (Supabase 유료)

- **Supabase PostgreSQL**: 창업자 프로파일, 상태머신 데이터, 트리거 로그, 기상·공휴일·유동인구·상권변화 데이터
- **Supabase pgvector**: 법령·공고 문서 벡터 저장 및 유사도 검색
- **Supabase Realtime**: 트리거 알림 실시간 스트리밍
- **Supabase Storage**: 생성된 서류 초안 파일 저장
- **Supabase Auth**: 사용자 인증 / 세션 관리

### 백엔드

- **API 서버**: FastAPI (Python 3.11+)
- **스케줄러**: APScheduler (시간 기반 트리거)
- **PDF 처리**: PyMuPDF(좌표 오버레이), ReportLab(한글 CID 폴백), pdfplumber, pypdf

### 프론트엔드

- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **스타일**: Tailwind CSS + `@tailwindcss/typography` (마크다운 프로즈)
- **마크다운 렌더**: `react-markdown` + `remark-gfm` (Claude 법령 브리프 표시용)
- **차트**: Recharts
- **PDF 클라이언트**: pdfjs-dist, html2pdf.js
- **앱 지원**: PWA (Progressive Web App) — 웹/앱 공용

### 인프라

- **컨테이너**: Docker / Docker Compose
- **CI/CD**: GitHub Actions
- **프론트 배포**: Vercel

---

## 프로젝트 구조

```
BOSS/
├── frontend/                      # Next.js 14 (웹/앱 공용)
│   ├── app/
│   │   ├── auth/                  # 로그인 / 회원가입 (Supabase Auth)
│   │   ├── dashboard/
│   │   │   ├── page.tsx           # 메인 대시보드
│   │   │   ├── sales/             # 매출 입력·조회
│   │   │   ├── insights/          # AI 인사이트 (전년 동월·상권 평균·기상·공휴일)
│   │   │   ├── tax/               # 세금 기한 + 부가세 신고서 초안
│   │   │   ├── rag/               # 법령 검색 (하이브리드 3-way + Claude 브리프, 마크다운)
│   │   │   ├── profile/           # 창업자 / 사업자 정보 관리
│   │   │   └── notifications/     # 알림 이력
│   │   ├── location/              # 입지분석 페이지
│   │   ├── onboarding/            # 4단계 창업자 등록 위저드
│   │   ├── drafts/[type]/         # 서류 초안 PDF 좌표 오버레이 폼 (4종)
│   │   └── page.tsx               # 랜딩 페이지
│   ├── components/
│   │   ├── location/              # DistrictSelector / LlmReportPanel / 차트
│   │   ├── onboarding/            # Step1~4 / StepIndicator
│   │   ├── rag/                   # ResultCard / LlmSummaryPanel (ReactMarkdown)
│   │   └── tax/                   # TaxDeadlineList
│   └── lib/
│       └── supabase.ts            # Supabase 클라이언트
├── backend/
│   ├── api/
│   │   ├── main.py
│   │   ├── routers/               # 11개 엔드포인트 모듈
│   │   │   ├── health.py          # /health
│   │   │   ├── founders.py        # 창업자 프로파일 CRUD / 상태
│   │   │   ├── triggers.py        # 트리거 로그·수동 실행
│   │   │   ├── drafts.py          # ReportLab 마크다운→PDF 초안
│   │   │   ├── subsidies.py       # 기업마당 지원사업 매칭
│   │   │   ├── tax.py             # 세금 기한·부가세 계산·PDF
│   │   │   ├── location.py        # 마포 입지 시뮬레이터
│   │   │   ├── sales.py           # 매출 CRUD·월별 요약
│   │   │   ├── insights.py        # AI 인사이트 (실데이터 RAG)
│   │   │   ├── rag.py             # 하이브리드 검색·요약·수집·통계
│   │   │   ├── subsidies.py       # 지원사업 캘린더·상시·전용 하이브리드 검색
│   │   │   └── pdf_forms.py       # PyMuPDF 좌표 오버레이 (정부 서식 4종)
│   │   └── schemas/               # Pydantic 스키마
│   ├── agents/
│   │   ├── orchestrator.py        # LangGraph 오케스트레이터 + 상태머신
│   │   ├── subsidy.py             # 지원사업 에이전트
│   │   ├── tax.py                 # 세금/일정 에이전트
│   │   ├── location.py            # 마포구 입지분석 에이전트
│   │   ├── hiring.py              # 채용/서류 에이전트
│   │   └── gemini.py              # Google Gemini 보조 에이전트
│   ├── analysis/
│   │   └── simulator.py           # 입지 시뮬레이션 엔진 (5지표 + 위험도)
│   ├── core/
│   │   ├── config.py              # pydantic-settings 환경 변수
│   │   ├── constants.py           # 업종·단계·마포구·카테고리 상수
│   │   └── holidays.py            # 공휴일 판정 유틸
│   ├── db/
│   │   ├── client.py              # Supabase 클라이언트
│   │   └── migrations/            # SQL 마이그레이션 001~014
│   ├── notifications/
│   │   ├── email.py
│   │   ├── kakao.py
│   │   └── realtime.py            # Supabase Realtime 알림
│   ├── rag/
│   │   ├── document_loader.py     # PDF/MD/TXT 로더
│   │   ├── ingest.py              # 청킹 → 임베딩 → pgvector
│   │   ├── subsidy_ingest.py      # 지원사업 공고 → subsidy_programs.embedding
│   │   ├── embeddings/            # BGE-M3 (로컬) + OpenAI 폴백
│   │   └── retriever/
│   │       └── pgvector_retriever.py  # 3-way RRF (vector + FTS + trigram)
│   ├── tax/
│   │   ├── vat_calculator.py      # 간이/일반과세자 부가세 계산
│   │   ├── pdf_generator.py       # 국세청 서식 PyMuPDF 오버레이
│   │   ├── hometax_guide.py       # 홈택스 단계별 가이드
│   │   └── forms/                 # 공식 서식 PDF (44호·21호)
│   ├── triggers/
│   │   ├── scheduler.py           # APScheduler
│   │   ├── state.py               # 상태 전이 트리거
│   │   ├── inference.py           # LLM 추론 기반 트리거
│   │   └── hiring_inference.py    # 채용 전용 추론
│   ├── data/
│   │   ├── crawlers/
│   │   │   ├── bizinfo.py              # 기업마당 공고
│   │   │   ├── law_api.py              # 법제처 Open API
│   │   │   ├── seoul_open.py           # 서울 열린데이터
│   │   │   ├── seoul_alley.py / alley.py  # 골목상권
│   │   │   ├── tax_calendar.py         # 세금 기한
│   │   │   ├── holiday_crawler.py      # 공휴일
│   │   │   ├── weather_crawler.py      # 기상청
│   │   │   └── mapo_population_crawler.py  # 마포구 유동인구
│   │   ├── parsers/
│   │   │   ├── pdf_parser.py
│   │   │   └── commercial_change_parser.py  # 마포구 개폐업 CSV
│   │   └── seeds/
│   │       ├── holidays.json
│   │       ├── mapo_stats.json
│   │       └── commercial_change/         # 개폐업 CSV
│   └── scripts/
│       ├── ingest_docs.py
│       ├── ingest_laws.py                 # 법제처 법령 수집·임베딩
│       ├── seed_holidays.py
│       ├── seed_weather.py
│       ├── seed_mapo_population.py
│       ├── seed_commercial_change.py
│       ├── seed_mapo_stats.py
│       ├── seed_strategy.py
│       ├── backfill_subsidies.py         # 기업마당 '창업' 스냅샷 백필
│       └── ingest_subsidies.py           # 지원사업 공고 임베딩
├── backtest/
│   └── evaluate.py                # Precision/Recall 백테스트
├── scripts/
│   └── test_pdf_fill.py           # PDF 좌표 오버레이 테스트
├── docs/                          # 표준서식 PDF + 분석 문서
│   └── feature-9-10-analysis.md
├── docker-compose.yml
├── CHANGELOG.md
├── CLAUDE.md
└── README.md
```

---

## 에이전트 구조

### 오케스트레이터

- LangGraph로 구현
- 창업자 상태(셋업/초기운영/성장)를 Supabase에 저장 및 추적
- 상태에 따라 적절한 하위 에이전트로 라우팅

### 하위 에이전트

| 에이전트   | 담당                                                   |
| ---------- | ------------------------------------------------------ |
| `subsidy`  | 기업마당 공고 수집, 업종/지역/단계 필터링, 신청서 초안 |
| `tax`      | 세금 기한 관리, 신고서 초안, 인허가 일정               |
| `location` | 골목상권 데이터 기반 입지 분석, 생존율 시뮬레이션      |
| `hiring`   | 채용공고 초안 생성, 근로계약서 초안, 주휴수당 계산     |
| `gemini`   | Google Gemini 기반 보조 추론 (멀티 LLM 실험용)         |

### Proactive 트리거 4종

| 유형        | 구현                      | 예시                               |
| ----------- | ------------------------- | ---------------------------------- |
| 시간 기반   | APScheduler               | 부가세 D-14 알림                   |
| 상태 전이   | LangGraph 이벤트          | 사업자등록 완료 → 다음 단계 시작   |
| 이벤트 감지 | 크롤러 + 임베딩 변화 감지 | 새 지원사업 공고 매칭              |
| 추론 기반   | LLM 판단                  | "오픈 3개월 = 알바 필요 시점" 추론 |

---

## 데이터 소스

| 데이터             | 출처                                                 | 방법                     |
| ------------------ | ---------------------------------------------------- | ------------------------ |
| 지원사업 공고      | 기업마당 공공API                                     | API 호출                 |
| 세금 신고 기한     | 국세청 홈택스                                        | 하드코딩 (연 갱신)       |
| 창업 입지          | 서울 열린데이터 (VwsmAdstrdStorW · VwsmAdstrdFlpopW) | 서울 열린데이터 API      |
| 식품위생 인허가    | 식품안전나라, 정부24                                 | 크롤링 + RAG 문서화      |
| 규제법령           | 법제처 Open API                                      | API 호출 + BGE-M3 임베딩 |
| 표준 근로계약서    | 고용노동부                                           | PDF 파싱                 |
| 표준 임대차계약서  | 법제처                                               | PDF 파싱                 |
| 최저임금 / 4대보험 | 고용노동부, 건강보험공단                             | 하드코딩 (연 1회 갱신)   |
| 공휴일 데이터      | 공공데이터포털 특일정보                              | API 호출 + 시드 JSON     |
| 기상 데이터        | 기상청 단기예보 API                                  | API 호출 + Supabase 저장 |
| 마포구 유동인구    | 서울 열린데이터 (상권별 유동인구)                    | API 호출                 |
| 마포구 개폐업 통계 | 서울 열린데이터 (상권변화지표)                       | CSV 파싱                 |

---

## Supabase 테이블 설계

### pgvector / pg_trgm 활성화

```sql
-- Supabase SQL Editor에서 최초 1회 실행
create extension if not exists vector;
create extension if not exists pg_trgm;  -- 한국어 복합어 대응
```

### 관계형 테이블

```sql
-- 창업자 프로파일
users (id, email, business_type, region, stage, created_at)

-- 창업 단계 상태머신
founder_state (user_id, stage, sub_stage, updated_at)

-- 트리거 이력
trigger_log (id, user_id, trigger_type, message, draft_url, sent_at, read_at)

-- 지원사업 매칭 결과
subsidy_matches (id, user_id, program_id, score, deadline, status)

-- 생성된 서류 초안
drafts (id, user_id, type, storage_path, metadata jsonb, created_at)

-- 창업자 재무 데이터 (매출/매입)
founder_financials (id, user_id, year, month, sales_card, sales_cash, sales_delivery,
                    sales_tax_invoice, purchase_tax_invoice, created_at)

-- 사업자 기본 정보
founder_business_info (user_id, business_name, owner_name, business_number,
                       business_type, tax_type, address, updated_at)

-- 기상 데이터 (migrations/010_weather.sql)
weather (date, region_code, temp_avg, rainfall, ...)
```

### 벡터 테이블 (pgvector + 하이브리드 인덱스)

```sql
-- 법령 청크 (계층: article + paragraph)
create table law_chunks (
  id             bigserial primary key,
  category       text,        -- 'license' | 'tax' | 'labor' | 'lease' | 'subsidy' | 'regulation'
  source         text,        -- '식품위생법', '근로기준법' 등
  chunk_index    int,
  chunk_type     text,        -- 'article' | 'paragraph'
  paragraph_no   int,
  paragraph_char text,
  parent_doc_id  bigint,
  content        text,
  embedding      vector(1024),-- BAAI/bge-m3 (OpenAI 폴백 시 1536)
  metadata       jsonb,
  created_at     timestamptz default now()
);

-- 벡터 검색 인덱스 (HNSW — 카테고리 pre-filter 안정)
create index law_chunks_embedding_idx
  on law_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Trigram 인덱스 (한국어 복합어 대응)
create index law_chunks_content_trgm_idx
  on law_chunks using gin (content gin_trgm_ops);
```

### 하이브리드 검색 함수 (3-way RRF)

`migrations/012_hybrid_search_trigram.sql` — 벡터 + FTS + trigram 랭커를 Reciprocal Rank Fusion으로 결합.

```sql
create or replace function hybrid_search(
  query_text       text,
  query_embedding  text,              -- PostgREST 직렬화 대응: text로 받아 내부 ::vector 캐스팅
  match_count      integer          default 10,
  filter_category  text             default null,
  rrf_k            integer          default 60,
  min_score        double precision default 0.3,   -- 벡터 최소 코사인 유사도
  min_trgm_score   double precision default 0.5,   -- trigram word_similarity 하한
  min_content_len  integer          default 40     -- 제목만 있는 청크 제외
)
returns table (
  id bigint, content text, metadata jsonb, chunk_type text,
  paragraph_no integer, paragraph_char text, parent_doc_id bigint,
  score double precision,      -- RRF 점수 (정렬용)
  similarity double precision  -- 실제 코사인 유사도 % (사용자 표시용)
)
...
```

### 청킹 전략

```
법령 문서   → 계층 2단계 청킹
              article 청크 (조문 전체) + paragraph 청크 (항 단위)
              parent_doc_id로 연결 — 정밀 검색 + 컨텍스트 복원
절차 안내   → 단계(Step) 단위 청킹
공고 문서   → 공고 1건 = 1청크
metadata 예시:
  { "law": "식품위생법", "article": "제36조", "chunk_type": "paragraph",
    "paragraph_no": 1, "business_type": ["카페"] }
```

### 마이그레이션 목록

| 파일                                                  | 목적                                                   |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `001_initial.sql`                                     | 기본 테이블                                            |
| `002_bge_m3_vector.sql` / `002_bge_vector.sql`        | pgvector 확장 + 임베딩 설정                            |
| `002_location.sql`                                    | 입지 리포트 테이블                                     |
| `002_tax_deadlines.sql`                               | 세금 기한 시드                                         |
| `003_bge_m3_dimension.sql` / `003_vector_dim_bge.sql` | 벡터 차원 확정 (1024)                                  |
| `004_hybrid_law_chunks.sql`                           | law_chunks + FTS 인덱스                                |
| `005_financials.sql`                                  | 창업자 재무 테이블 + mock                              |
| `006_fix_hybrid_search.sql`                           | 초기 RRF 함수                                          |
| `007_law_chunks_table.sql`                            | 스키마 리파인                                          |
| `008_fix_vector_text_param.sql`                       | `vector` → `text` 파라미터 (PostgREST 워크어라운드)    |
| `009_fix_ivfflat_index.sql`                           | ivfflat → HNSW 교체                                    |
| `010_weather.sql`                                     | 기상 데이터 테이블                                     |
| `011_hybrid_search_cosine_similarity.sql`             | RRF score ↔ 실제 cosine similarity 컬럼 분리           |
| `012_hybrid_search_trigram.sql`                       | pg_trgm 3-way RRF + `char_length > 40` 필터            |
| `013_subsidy_programs.sql`                            | 지원사업 공고 테이블 + fetch_log 멱등성                |
| `014_subsidy_programs_search.sql`                     | 공고 전용 embedding + `search_subsidies` RPC           |
| `015_expenses.sql`                                    | 비용 관리 테이블 (RLS 4정책)                           |
| `015_subsidy_attachments.sql`                         | HWP 메타데이터·원문 캐시                               |
| `016_subsidy_draft_answers.sql`                       | 신청서 답변 저장 테이블                                |
| `017_menus_and_sales_items.sql`                       | menus + sales_items 테이블                             |
| `017_seoul_open_cache.sql`                            | 서울 열린데이터 API 캐시                               |
| `018_fix_subsidy_matches_fk.sql`                      | subsidy_matches FK 제약 수정                           |
| `018_seoul_raw_data.sql`                              | seoul_store_stats + seoul_flpop_stats + sbiz_tradearea |
| `019_district_features.sql`                           | 행정동별 ML 피처 테이블                                |
| `019_founder_financials.sql`                          | 창업자 재무 테이블 보완                                |
| `020_location_sessions.sql`                           | 입지분석 개인화 세션 저장                              |
| `021_district_features_rename.sql`                    | district_features 테이블 명칭 정비                     |

---

## 버전 관리

[SemVer](https://semver.org) 형식: `MAJOR.MINOR.PATCH`

- **MAJOR**: 호환되지 않는 API 변경
- **MINOR**: 하위 호환 기능 추가
- **PATCH**: 버그 수정

현재 버전: `v0.12.0`

커밋 메시지 컨벤션:

```
feat:     새 기능
fix:      버그 수정
docs:     문서 수정
refactor: 리팩터링
test:     테스트
chore:    빌드/설정
```

자세한 변경 이력은 [CHANGELOG.md](./CHANGELOG.md) 참조.

---

## 반드시 지켜야 할 원칙

### 작업 진행 방식

- 확인·권한 요청 없이 항상 바로 진행한다. "진행할까요?", "괜찮을까요?" 같은 질문 금지
- 작업 완료 후 결과만 간결하게 보고한다

### 법적 책임 범위

```
❌ "이 계약서 조항은 문제없습니다"       — 절대 금지
✅ "이 조항은 일반적으로 OO를 의미합니다" — 이 수준까지만
```

모든 세금·법률·계약 관련 출력 하단에 면책 고지 포함:

> "본 내용은 참고용이며 실제 신고 및 계약 전 전문가 확인을 권장합니다."

### 코드 작성 원칙

- 에이전트 응답에 면책 고지 자동 삽입
- 크롤링 전 robots.txt 및 이용약관 확인
- Supabase RLS(Row Level Security) 반드시 적용 — 사용자 간 데이터 격리
- 민감 정보(사업자번호, 매출액)는 환경변수로 관리, 코드에 하드코딩 금지

### 스코프 원칙

- 서울 F&B 소상공인에 집중. 전국/SaaS 확장은 v2.0 이후
- 투자자 웜패스, IR 덱 기능은 현재 스코프 밖

---

## 백테스트 평가 기준

| 항목                 | 측정 방법                                              |
| -------------------- | ------------------------------------------------------ |
| 지원사업 추천 정확도 | Precision / Recall (과거 공고 vs AI 추천)              |
| 입지 분석 정확도     | 추천 입지 vs 실제 개폐업 생존율 (골목상권 과거 데이터) |
| 트리거 타이밍        | D-5 vs D-3 알림 → 신청 완료율 A/B 비교                 |
| RAG 검색 품질        | 벡터 단독 vs 3-way RRF 정답 포함률 (recall@5)          |

---

## 챗봇 기능 개발 규칙 ⚠️ 필수 준수

### 기존 코드 보호 (절대 원칙)

- **기존 파일을 절대 수정하거나 삭제하지 않는다**
- 챗봇 관련 코드는 반드시 **신규 파일로만** 추가
- 기존 라우터·컴포넌트·스키마에 챗봇 로직을 끼워 넣지 않는다
- 기존 파일에 import 추가도 금지 — 필요하면 신규 파일에서 기존 모듈을 import하는 방향으로

### Supabase 연동 방식

- 이미 임베딩된 pgvector 데이터는 **API(RPC) 방식으로만** 연동
- 임베딩 재생성·테이블 구조 변경·기존 데이터 조작 금지
- `hybrid_search` RPC 함수를 그대로 활용 (재정의 금지)

---

## Commit / Push 워크플로우 (필수 순서)

작업 완료 후 commit·push 전 반드시 아래 순서를 따른다:

1. **dev 최신 상태 반영**
   ```bash
   git fetch origin
   git merge origin/dev   # 충돌 발생 시 해결 후 진행
   ```
2. **CHANGELOG.md 작성** — 변경 내용을 버전에 맞게 기재
3. **commit** — 작업 파일 + CHANGELOG.md 함께 스테이징
4. **push** — 원격 브랜치에 push

> dev 최신화 없이 바로 commit·push하지 않는다.
