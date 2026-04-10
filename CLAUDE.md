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

- **대상**: 서울에서 처음 F&B 창업하는 1인 소상공인
- **업종**: 카페 / 베이커리 / 분식 (식품위생 인허가 공통)
- **지역**: 서울 한정 (골목상권 서울 데이터 기반)
- **기간**: 창업 결심 ~ 오픈 후 1년

---

## 기술 스택

### AI / LLM
- **LLM**: Claude API (`claude-sonnet-4-6`) — 초안 생성, 추론 기반 트리거
- **멀티에이전트**: LangGraph — 상태머신 + 에이전트 오케스트레이션
- **RAG 파이프라인**: LangChain + LlamaIndex

### RAG / 임베딩
- **벡터 DB**: ChromaDB (로컬)
- **임베딩 모델**: OpenAI `text-embedding-3-small`

### 데이터베이스 (Supabase)
- **Supabase PostgreSQL**: 창업자 프로파일, 상태머신 데이터, 트리거 로그
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
│   ├── app/                 # App Router 페이지
│   ├── components/          # 공용 컴포넌트
│   └── public/
├── backend/
│   ├── api/                 # FastAPI 라우터
│   ├── agents/
│   │   ├── orchestrator.py  # 오케스트레이터 + 상태머신 (LangGraph)
│   │   ├── subsidy.py       # 지원사업 에이전트
│   │   ├── tax.py           # 세금/일정 에이전트
│   │   ├── location.py      # 입지분석 에이전트
│   │   └── hiring.py        # 채용/서류 에이전트
│   ├── rag/
│   │   ├── embeddings/      # 임베딩 생성 로직
│   │   ├── vectordb/        # ChromaDB 저장소
│   │   └── retriever/       # 검색 로직
│   ├── triggers/
│   │   ├── scheduler.py     # 시간 기반 트리거 (APScheduler)
│   │   ├── state.py         # 상태 전이 트리거
│   │   └── inference.py     # 추론 기반 트리거 (LLM 판단)
│   └── data/
│       ├── crawlers/        # 기업마당, 골목상권 크롤러
│       ├── parsers/         # PDF 파싱 (정부 표준서식)
│       └── raw/             # 수집 원본 데이터
├── backtest/
│   └── evaluate.py          # 백테스트 평가 (Precision/Recall)
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
| 에이전트 | 담당 |
|---------|------|
| `subsidy` | 기업마당 공고 수집, 업종/지역/단계 필터링, 신청서 초안 |
| `tax` | 세금 기한 관리, 신고서 초안, 인허가 일정 |
| `location` | 골목상권 데이터 기반 입지 분석, 생존율 시뮬레이션 |
| `hiring` | 채용공고 초안 생성, 근로계약서 초안, 주휴수당 계산 |

### Proactive 트리거 4종
| 유형 | 구현 | 예시 |
|------|------|------|
| 시간 기반 | APScheduler | 부가세 D-14 알림 |
| 상태 전이 | LangGraph 이벤트 | 사업자등록 완료 → 다음 단계 시작 |
| 이벤트 감지 | 크롤러 + 임베딩 변화 감지 | 새 지원사업 공고 매칭 |
| 추론 기반 | LLM 판단 | "오픈 3개월 = 알바 필요 시점" 추론 |

---

## 데이터 소스

| 데이터 | 출처 | 방법 |
|--------|------|------|
| 지원사업 공고 | 기업마당 공공API | API 호출 |
| 세금 신고 기한 | 국세청 홈택스 | 하드코딩 (연 갱신) |
| 창업 입지 | 골목상권 서울 | JSON 엔드포인트 크롤링 |
| 식품위생 인허가 | 식품안전나라, 정부24 | 크롤링 + RAG 문서화 |
| 표준 근로계약서 | 고용노동부 | PDF 파싱 |
| 표준 임대차계약서 | 법제처 | PDF 파싱 |
| 최저임금 / 4대보험 | 고용노동부, 건강보험공단 | 하드코딩 (연 1회 갱신) |

---

## Supabase 테이블 설계 (예정)

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

---

## 버전 관리

[SemVer](https://semver.org) 형식: `MAJOR.MINOR.PATCH`

- **MAJOR**: 호환되지 않는 API 변경
- **MINOR**: 하위 호환 기능 추가
- **PATCH**: 버그 수정

현재 버전: `v0.1.0`

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

| 항목 | 측정 방법 |
|------|-----------|
| 지원사업 추천 정확도 | Precision / Recall (과거 공고 vs AI 추천) |
| 입지 분석 정확도 | 추천 입지 vs 실제 개폐업 생존율 (골목상권 과거 데이터) |
| 트리거 타이밍 | D-5 vs D-3 알림 → 신청 완료율 A/B 비교 |
