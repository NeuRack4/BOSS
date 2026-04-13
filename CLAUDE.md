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

- **LLM**: Claude API (`claude-sonnet-4-6`) — 초안 생성, 추론 기반 트리거
- **멀티에이전트**: LangGraph — 상태머신 + 에이전트 오케스트레이션
- **RAG 파이프라인**: LangChain + LlamaIndex

### RAG / 임베딩

- **벡터 DB**: Supabase pgvector (유료 플랜 내장 — ChromaDB 사용 안 함)
- **임베딩 모델**: `BAAI/bge-m3` (1024차원, 로컬 GPU/CPU — sentence-transformers)
- **폴백 임베딩**: OpenAI `text-embedding-3-small` (1536차원)
- **이점**: 관계형 데이터(창업자 프로파일)와 벡터 검색을 단일 DB에서 처리 가능

### 데이터베이스 (Supabase 유료)

- **Supabase PostgreSQL**: 창업자 프로파일, 상태머신 데이터, 트리거 로그
- **Supabase pgvector**: 법령·공고 문서 벡터 저장 및 유사도 검색 (별도 벡터DB 불필요)
- **Supabase Realtime**: 트리거 알림 실시간 스트리밍
- **Supabase Storage**: 생성된 서류 초안 파일 저장
- **Supabase Auth**: 사용자 인증 / 세션 관리

### 백엔드

- **API 서버**: FastAPI (Python)
- **스케줄러**: APScheduler (시간 기반 트리거)

### 프론트엔드

- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **스타일**: Tailwind CSS
- **앱 지원**: PWA (Progressive Web App) — 웹/앱 공용

### 인프라

- **컨테이너**: Docker / Docker Compose
- **CI/CD**: GitHub Actions
- **프론트 배포**: Vercel

---

## 프로젝트 구조

```
BOSS/
├── frontend/                # Next.js 14 (웹/앱 공용)
│   ├── app/
│   │   ├── auth/            # 로그인 / 회원가입 (Supabase Auth)
│   │   ├── dashboard/       # 대시보드 + 매출 관리
│   │   ├── location/        # 입지분석 페이지
│   │   ├── onboarding/      # 4단계 창업자 등록 위저드
│   │   └── page.tsx         # 랜딩 페이지
│   ├── components/
│   │   ├── location/        # DistrictSelector / LlmReportPanel / 차트
│   │   └── onboarding/      # Step1~4 / StepIndicator
│   └── lib/
│       └── supabase.ts      # Supabase 클라이언트
├── backend/
│   ├── api/                 # FastAPI 서버
│   │   ├── main.py
│   │   ├── routers/         # founders / triggers / drafts / subsidies / tax / location / sales
│   │   └── schemas/         # Pydantic 스키마
│   ├── agents/
│   │   ├── orchestrator.py  # LangGraph 오케스트레이터 + 상태머신
│   │   ├── subsidy.py       # 지원사업 에이전트
│   │   ├── tax.py           # 세금/일정 에이전트
│   │   ├── location.py      # 마포구 입지분석 에이전트
│   │   └── hiring.py        # 채용/서류 에이전트
│   ├── analysis/
│   │   └── simulator.py     # 입지 시뮬레이션 엔진 (5개 지표 + 위험도)
│   ├── core/
│   │   ├── config.py        # pydantic-settings 환경 변수
│   │   └── constants.py     # 업종·단계·마포구 상수
│   ├── db/
│   │   ├── client.py        # Supabase 클라이언트
│   │   └── migrations/      # SQL 마이그레이션 (001~003)
│   ├── notifications/
│   │   ├── email.py         # 이메일 알림
│   │   ├── kakao.py         # 카카오톡 알림
│   │   └── realtime.py      # Supabase Realtime 알림
│   ├── rag/
│   │   ├── ingest.py        # 문서 수집 → 청킹 → 임베딩 → Supabase
│   │   ├── embeddings/      # BGE-M3 (로컬) + OpenAI 임베딩
│   │   └── retriever/       # pgvector 유사도 검색
│   ├── triggers/
│   │   ├── scheduler.py     # APScheduler 시간 기반 트리거
│   │   ├── state.py         # 상태 전이 트리거
│   │   ├── inference.py     # LLM 추론 기반 트리거
│   │   └── hiring_inference.py  # 채용 전용 추론 트리거
│   └── data/
│       ├── crawlers/        # 기업마당 / 골목상권 / 법제처 / 세금달력
│       ├── parsers/         # PDF 파싱
│       └── seeds/           # 세금 기한 초기 데이터
├── backtest/
│   └── evaluate.py          # 백테스트 평가 (Precision/Recall)
├── scripts/
│   └── ingest_regulations.py  # 규제법령 일괄 임베딩 스크립트
├── docs/
│   └── 사업자등록_필요서류_템플릿.md
├── docker-compose.yml
├── CLAUDE.md
└── README.md
```

---

## 에이전트 구조

### 오케스트레이터

- LangGraph로 구현
- 창업자 상태(셋업/초기운영/성장)를 Supabase에 저장 및 추적
- 상태에 따라 적절한 하위 에이전트로 라우팅

### 하위 에이전트 4종

| 에이전트   | 담당                                                   |
| ---------- | ------------------------------------------------------ |
| `subsidy`  | 기업마당 공고 수집, 업종/지역/단계 필터링, 신청서 초안 |
| `tax`      | 세금 기한 관리, 신고서 초안, 인허가 일정               |
| `location` | 골목상권 데이터 기반 입지 분석, 생존율 시뮬레이션      |
| `hiring`   | 채용공고 초안 생성, 근로계약서 초안, 주휴수당 계산     |

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

---

## Supabase 테이블 설계

### pgvector 활성화

```sql
-- Supabase SQL Editor에서 최초 1회 실행
create extension if not exists vector;
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
drafts (id, user_id, type, storage_path, created_at)
```

### 벡터 테이블 (pgvector)

```sql
-- RAG 문서 저장
create table documents (
  id          bigserial primary key,
  category    text,        -- 'license' | 'tax' | 'labor' | 'lease' | 'subsidy'
  source      text,        -- '식품위생법 시행규칙', '근로기준법' 등
  chunk_index int,
  content     text,        -- 원문 청크
  embedding   vector(1024),-- BAAI/bge-m3 기준 (OpenAI 폴백 시 1536)
  metadata    jsonb,       -- 업종·조항 등 필터용
  created_at  timestamptz default now()
);

-- 벡터 검색 인덱스
create index on documents
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
```

### 유사도 검색 함수

```sql
create or replace function match_documents (
  query_embedding  vector(1024),  -- BGE-M3 기준
  match_threshold  float,
  match_count      int,
  filter_category  text default null
)
returns table (id bigint, content text, metadata jsonb, similarity float)
language sql stable as $$
  select
    id, content, metadata,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  where
    (filter_category is null or category = filter_category)
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

### 청킹 전략

```
법령 문서   → 조항(Article) 단위 청킹 — 의미 완결 단위
절차 안내   → 단계(Step) 단위 청킹
공고 문서   → 공고 1건 = 1청크
metadata 예시:
  { "law": "식품위생법", "article": "제36조", "business_type": ["카페"] }
```

---

## 버전 관리

[SemVer](https://semver.org) 형식: `MAJOR.MINOR.PATCH`

- **MAJOR**: 호환되지 않는 API 변경
- **MINOR**: 하위 호환 기능 추가
- **PATCH**: 버그 수정

현재 버전: `v0.3.2`

커밋 메시지 컨벤션:

```
feat:     새 기능
fix:      버그 수정
docs:     문서 수정
refactor: 리팩터링
test:     테스트
chore:    빌드/설정
```

---

## 반드시 지켜야 할 원칙

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
