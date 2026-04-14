# BOSS

### Business Operations Support System

> 서울 F&B 소상공인을 위한 Proactive AI 비서

[![version](https://img.shields.io/badge/version-0.4.3-blue.svg)](https://semver.org)
[![license](https://img.shields.io/badge/license-MIT-green.svg)]()

창업자가 요청하지 않아도 에이전트가 먼저 챙깁니다.  
**검토하고 제출만 하세요.**

---

## 왜 BOSS인가?

| 기존 서비스                | BOSS                             |
| -------------------------- | -------------------------------- |
| 물어봐야 답한다 (Reactive) | 먼저 알려준다 (Proactive)        |
| 정보만 나열한다            | 초안을 들고 온다                 |
| 각 기능이 파편화되어 있다  | 창업 여정 전체를 하나의 맥락으로 |

```
"마포구에서 카페 창업할 거야"

→ 다음날:    사업자등록 서류 초안
             식품위생교육 신청 일정
             네이버/카카오/구글 등록 패키지

→ 3주 후:   "예비창업패키지 마감 D-5입니다. 신청서 초안 준비했어요"

→ 3개월 후: "주말 피크타임 알바 필요하지 않으세요?
             채용공고 초안 만들어드릴까요?"

→ 6개월 후: "부가세 신고 2주 남았습니다. 자료 초안 여기 있어요"
```

---

## 타겟

- **누구?** 서울 마포구에서 처음 카페 창업하는 1인 소상공인
- **언제?** 창업 결심 시점 ~ 오픈 후 1년
- **어디?** 서울 마포구 (홍대입구·합정·연남동·망원동·공덕·성산동·마포대로·아현동·신수동 9개 상권 데이터 기반)

> v0.x 스코프: **마포구 카페 단일 업종**에 집중합니다.  
> 전국 / 다업종 확장은 v2.0 이후 로드맵입니다.

---

## 핵심 기능

### 1. 창업자 온보딩 (4단계 위저드)

- Step 1 — 개인정보: 이름, 생년월일, 연락처, 주민등록번호 앞자리
- Step 2 — 사업 정보: 업종, 상호명, 지역, 창업 단계, 법인 유형
- Step 3 — 위치 정보: 주소, 면적
- Step 4 — 필요 서류 선택 → BOSS에게 초안 위임

### 2. 입지 분석 시뮬레이션

- 마포구 9개 상권(홍대입구·합정·연남동·망원동·공덕·성산동·마포대로·아현동·신수동) 비교 분석
- 데이터 소스: 서울 열린데이터 `VwsmAdstrdStorW`(상가업소 현황) + `VwsmAdstrdFlpopW`(유동인구)
- 5개 지표: 포화도 지수 / 예상 월매출 / 손익분기(BEP) / 생존율 / 성장 잠재력
- 상권별 위험도 등급 (LOW / MED / HIGH)
- Claude LLM 기반 종합 해석 리포트
- 분석 결과 7일 캐시 (Supabase `location_reports`)
- 레이더 차트·생존율 바 차트 시각화
- 검색 이력 자동 저장 및 원클릭 재실행

### 3. 지원사업 모니터링

- 기업마당 공고 실시간 수집
- 업종 / 지역 / 창업 단계 맞춤 필터링
- 마감 D-5, D-3 선제 알림 + 신청서 초안 자동 생성

### 4. 세금 · 행정 관리

- 부가세(1/25, 7/25) · 종합소득세(5월) · 원천세(매월 10일) 기한 관리
- APScheduler 기반 D-14/D-7/D-1 선제 알림
- **부가가치세 신고서 자동 생성** — 간이/일반과세자 자동 분기
  - 국세청 공식 서식 PDF (별지 제44호·제21호) PyMuPDF 좌표 오버레이
  - 매출 데이터 자동 집계 → 세액 계산 → PDF 채우기 → Supabase Storage 저장
  - 홈택스 단계별 입력 가이드 자동 생성
  - 공식 서식 없을 경우 ReportLab 한글 CID 폰트 폴백

### 5. 채용 자동화

- LLM 추론 트리거: 운영 기간·매출 패턴·메뉴 수를 분석해 채용 적기 판단
- 개강시즌(3/9월) D-30, 연말 성수기(12월) D-45 선제 알림
- 잡코리아·알바천국·당근알바 형식 공고 초안 자동 생성
- 고용노동부 표준 근로계약서 초안 + 주휴수당 자동 계산

### 6. 매출 관리 & AI 인사이트

- 일별 매출 입력 (카테고리: 음료/디저트/기타 · 시간대: 오전/오후/저녁)
- 매출 합계 / 카테고리별·시간대별 분석
- 피크 시간대 자동 감지 → 채용 추론 신호로 활용
- **마포구 카페 벤치마크 비교** — 실데이터 기반 RAG 인사이트 (전년 동월 대비, 상권 평균 대비)
- 서울 열린데이터 기반 상권 통계 자동 업데이트

### 7. 법령 RAG 검색

- 법제처 Open API → 식품위생법 등 규제법령 계층적 청킹 (조문·항 2단계)
- BGE-M3 (1024차원) 하이브리드 임베딩 → Supabase pgvector 저장
- Claude LLM 기반 검색 결과 요약

---

## 시스템 아키텍처

```
입력: "마포구 카페 창업할 거야"
        │
        ▼
┌─────────────────────────────┐
│        창업자 프로파일       │
│  업종 / 지역 / 단계 / 법인  │
│        상태머신 초기화       │
│  셋업 → 초기운영 → 성장     │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│             오케스트레이터 (LangGraph)   │
│  상태 파악 → 할 일 목록 로드            │
│  마감 기한 계산 → 에이전트 라우팅       │
└───┬──────────┬──────────┬───────────────┘
    │          │          │
┌───▼──┐  ┌───▼──┐  ┌────▼───┐  ┌────────┐
│지원  │  │세금  │  │입지    │  │채용    │
│사업  │  │일정  │  │분석    │  │서류    │
│에이전│  │에이전│  │에이전트│  │에이전트│
│트    │  │트    │  │        │  │        │
└───┬──┘  └───┬──┘  └────┬───┘  └───┬────┘
    │          │          │          │
    └──────────┴──────────┴──────────┘
                     │
         ┌───────────▼──────────────┐
         │   Supabase pgvector      │
         │  (관계형 DB + 벡터 통합) │
         │  기업마당 공고            │
         │  식품위생법 / 세금 법령   │
         │  골목상권 서울            │
         │  표준서식 (계약서 등)     │
         └───────────┬──────────────┘
                     │
         ┌───────────▼──────────────┐
         │   Proactive 트리거 엔진  │
         │  ① 시간 기반 (D-day)    │
         │  ② 상태 전이 기반        │
         │  ③ 이벤트 감지 기반      │
         │  ④ 추론 기반 ← 핵심     │
         └───────────┬──────────────┘
                     │
              초안 생성 에이전트
         서류 / 신청서 / 공고 / 이메일
                     │
                     ▼
           창업자: 검토 후 제출만
```

---

## 기술 스택

### AI / LLM

| 기술                           | 용도                                                     |
| ------------------------------ | -------------------------------------------------------- |
| Claude API (claude-sonnet-4-6) | 메인 LLM — 초안 생성, 추론 기반 트리거, 입지 해석 리포트 |
| LangGraph                      | 상태머신 + 멀티에이전트 오케스트레이션                   |
| LangChain                      | RAG 파이프라인, 에이전트 체인 구성                       |

### RAG / 임베딩

| 기술                                | 용도                                    |
| ----------------------------------- | --------------------------------------- |
| Supabase pgvector                   | 벡터 DB — Supabase 내장, 별도 DB 불필요 |
| BAAI/bge-m3 (sentence-transformers) | 문서 임베딩 (1024차원, 로컬 GPU/CPU)    |
| OpenAI text-embedding-3-small       | 폴백 임베딩 (1536차원)                  |
| LlamaIndex                          | 문서 파싱 + 청킹 + 인덱싱               |

### 데이터 수집

| 기술                            | 용도                                   |
| ------------------------------- | -------------------------------------- |
| Python requests / BeautifulSoup | 기업마당 API 연동, 크롤링              |
| 법제처 Open API                 | 규제법령 RAG 문서 수집 (계층 청킹)     |
| 서울 열린데이터 API             | 상가업소·유동인구·골목상권 통계        |
| PyMuPDF (fitz)                  | 정부 표준서식 PDF 파싱 + 좌표 오버레이 |

### 백엔드

| 기술        | 용도                                        |
| ----------- | ------------------------------------------- |
| FastAPI     | REST API 서버                               |
| APScheduler | Proactive 트리거 스케줄러                   |
| Pydantic v2 | 스키마 + 환경변수 설정                      |
| PyMuPDF     | 국세청 공식 서식 PDF 좌표 오버레이 (부가세) |
| ReportLab   | 공식 서식 없을 때 폴백 PDF 생성 (한글 CID)  |

### 데이터베이스 (Supabase 유료)

| 기술                | 용도                                      |
| ------------------- | ----------------------------------------- |
| Supabase PostgreSQL | 창업자 프로파일 + 상태 저장 + 매출 데이터 |
| Supabase pgvector   | 법령·공고 문서 벡터 저장 및 유사도 검색   |
| Supabase Realtime   | 트리거 알림 실시간 스트리밍               |
| Supabase Storage    | 생성된 서류 초안 파일 저장                |
| Supabase Auth       | 사용자 인증 / 세션 관리                   |

### 프론트엔드

| 기술                      | 용도                                  |
| ------------------------- | ------------------------------------- |
| Next.js 14 (App Router)   | 웹 / 앱 공용 프론트엔드               |
| TypeScript                | 타입 안전성                           |
| Tailwind CSS              | 스타일링                              |
| Recharts                  | 입지분석 레이더 차트 · 생존율 바 차트 |
| PWA (Progressive Web App) | 모바일 앱 대응                        |

### 인프라

| 기술                    | 용도            |
| ----------------------- | --------------- |
| Docker / Docker Compose | 컨테이너화      |
| GitHub Actions          | CI/CD           |
| Vercel                  | 프론트엔드 배포 |

---

## API 엔드포인트

| 메서드 | 경로                                | 설명                                        |
| ------ | ----------------------------------- | ------------------------------------------- |
| GET    | `/health`                           | 서버 상태 확인                              |
| POST   | `/founders`                         | 창업자 프로파일 생성                        |
| GET    | `/founders/{id}`                    | 창업자 정보 조회                            |
| GET    | `/location/districts`               | 마포구 분석 가능 상권 목록                  |
| POST   | `/location/analyze`                 | 상권 비교 분석 실행 (7일 캐시)              |
| GET    | `/location/history`                 | 창업자 입지 검색 이력                       |
| POST   | `/sales`                            | 매출 데이터 입력                            |
| GET    | `/sales`                            | 매출 내역 조회                              |
| GET    | `/sales/summary`                    | 매출 요약 (카테고리·시간대별)               |
| GET    | `/insights`                         | AI 인사이트 (전년 동월 대비·상권 평균 대비) |
| GET    | `/subsidies`                        | 지원사업 목록                               |
| GET    | `/tax/deadlines`                    | 세금 기한 조회                              |
| POST   | `/tax/deadlines/sync`               | 세금 기한 공공데이터 동기화                 |
| POST   | `/tax/draft`                        | 세금 신고서 초안 생성 (체크리스트)          |
| POST   | `/tax/vat-draft`                    | 부가가치세 신고서 PDF 생성 (국세청 서식)    |
| GET    | `/tax/vat-draft/{id}/download`      | 부가가치세 신고서 PDF 다운로드              |
| GET    | `/tax/vat-draft/{id}/hometax-guide` | 홈택스 단계별 입력 가이드 조회              |
| POST   | `/triggers/run`                     | 트리거 수동 실행                            |
| GET    | `/drafts`                           | 생성된 서류 초안 목록                       |
| GET    | `/drafts/{id}/download`             | 초안 PDF 다운로드                           |
| POST   | `/rag/ingest/all`                   | docs/ 전체 문서 pgvector 수집               |
| POST   | `/rag/ingest/file`                  | 특정 파일 pgvector 수집                     |
| POST   | `/rag/search`                       | 법령 유사도 검색                            |
| POST   | `/rag/summarize`                    | 검색 결과 Claude 요약                       |
| GET    | `/rag/stats`                        | 카테고리별 저장 문서 수                     |

---

## Proactive 트리거 설계

```
① 시간 기반     세금신고 D-14 / D-7 / D-1, 지원사업 마감 D-5 / D-3
                개강시즌 D-30 (2/8월 15일), 연말 성수기 D-45 (11월 1일)
② 상태 전이     사업자등록 완료 → 다음 단계 자동 시작
                오픈 D+90 → 알바 채용 제안
③ 이벤트 감지   새 지원사업 공고 등록 → 업종 매칭 후 알림
④ 추론 기반     운영 기간·매출 패턴·메뉴 수 → 알바 필요 시점 Claude 판단
                개강시즌(홍대·연남동) 매출 급증 패턴 → 인력 선제 확보 알림
```

---

## 프론트엔드 화면 구성

| 경로                       | 설명                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| `/`                        | 랜딩 페이지 (Hero / Features / Scenario / Trigger / Stack / CTA) |
| `/auth/login`              | 로그인 (Supabase Auth)                                           |
| `/auth/signup`             | 회원가입 (Supabase Auth)                                         |
| `/onboarding`              | 4단계 창업자 등록 위저드                                         |
| `/dashboard`               | 매출 통계 + AI 인사이트 대시보드                                 |
| `/dashboard/sales`         | 일별 매출 입력 및 내역 조회                                      |
| `/dashboard/insights`      | 전년 동월 대비·상권 평균 대비 AI 인사이트                        |
| `/dashboard/tax`           | 세금 기한 목록 + 부가세 신고서 초안 생성                         |
| `/dashboard/rag`           | 법령 검색 (RAG) + Claude 요약                                    |
| `/dashboard/profile`       | 창업자 정보 및 사업자 정보 관리                                  |
| `/dashboard/notifications` | 알림 이력                                                        |
| `/location`                | 마포구 입지분석 (상권 비교·차트·LLM 리포트)                      |
| `/drafts/[type]`           | 서류 초안 PDF 오버레이 폼 (사업자등록·식품영업·근로계약·임대차)  |

---

## 버전 관리

[SemVer](https://semver.org) 형식을 따릅니다: `MAJOR.MINOR.PATCH`

| 버전   | 내용                                                                                                                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.1.0 | 백엔드 초기 구조, 메인 페이지, 대시보드/로그인/회원가입                                                                                                                                                                      |
| v0.2.0 | 규제법령 RAG (법제처 + BGE-M3), 입지분석 시뮬레이션, 세금 스케줄링, 채용 자동화, Sales API                                                                                                                                   |
| v0.3.0 | 창업자 온보딩 위저드 (4단계), 입지분석 UI (차트·리포트), 매출 입력 페이지, Supabase Auth 연동 완성                                                                                                                           |
| v0.3.1 | 입지분석 9개 상권 확대, 서울 열린데이터 API 전환, 검색 이력 UI, 인증 없이 분석 허용                                                                                                                                          |
| v0.3.2 | RAG API 라우터 추가 (ingest/search/summarize/stats), 세금 초안 PDF 다운로드 (ReportLab)                                                                                                                                      |
| v0.4.0 | 부가가치세 신고서 국세청 공식 서식 PDF (PyMuPDF 좌표 오버레이), 매출 인사이트 강화, 법령 계층적 청킹, DB 마이그레이션 004·005                                                                                                |
| v0.4.1 | 창업자 상태머신 활성화 — `GET /founders/me/state`, 상태 전이 트리거 연결, 오케스트레이터 DB 로드, 사이드바 현재 단계 표시, 온보딩 필수 항목 최소화                                                                           |
| v0.4.2 | 서류 초안 폼 UI — PDF 오버레이 방식 4종 (사업자등록신청서·식품영업신고서·표준근로계약서·상가임대차계약서), 프로필 페이지 `/dashboard/profile`, 온보딩 UX 개선, html2pdf 클라이언트 사이드 출력                               |
| v0.4.3 | 법령 검색 카테고리 필터 버그 수정 — `hybrid_search` RPC 파라미터 타입 `vector` → `text` 캐스팅, ivfflat → **HNSW** 인덱스 교체, 인허가 법령 `LICENSE`/`REGULATION` 카테고리 분리 (식품위생법·소방법·건축법 ↔ 개인정보보호법) |

현재 버전: **`v0.4.3`**

---

## 데이터 소스

| 데이터                  | 출처                                                 | 수집 방법                       |
| ----------------------- | ---------------------------------------------------- | ------------------------------- |
| 지원사업 공고           | 기업마당 공공API                                     | API 호출                        |
| 세금 신고 기한          | 국세청 홈택스                                        | 하드코딩 + 크롤링               |
| 창업 입지 데이터        | 서울 열린데이터 (VwsmAdstrdStorW · VwsmAdstrdFlpopW) | 서울 열린데이터 API             |
| 골목상권 통계           | 서울 열린데이터 골목상권 분석 서비스                 | 서울 열린데이터 API             |
| 식품위생 인허가 절차    | 식품안전나라, 정부24                                 | 크롤링 + RAG 문서화             |
| 규제법령                | 법제처 Open API                                      | API 호출 + BGE-M3 임베딩 (계층) |
| 표준 근로계약서         | 고용노동부                                           | PDF 파싱                        |
| 표준 임대차계약서       | 법제처                                               | PDF 파싱                        |
| 최저임금 / 4대보험 요율 | 고용노동부, 건강보험공단                             | 하드코딩 (연 1회 갱신)          |

---

## 백테스트 구조

```
지원사업 추천 정확도
  과거 공고 데이터 → AI 추천 → 실제 업종 적합 여부 비교
  측정: Precision / Recall

입지 분석 정확도
  골목상권 과거 데이터 → 추천 입지 → 실제 생존율 비교

Proactive 타이밍
  D-5 vs D-3 알림 → 신청 완료율 A/B 비교
```

---

## 빠른 시작

```bash
# 1. 환경 변수 설정
cp .env.example .env
# .env 에 Supabase / Anthropic 키 입력

# 2. DB 초기화 (Supabase SQL Editor에서 순서대로 실행)
# backend/db/migrations/001_initial.sql
# backend/db/migrations/002_location.sql
# backend/db/migrations/002_tax_deadlines.sql
# backend/db/migrations/003_bge_m3_dimension.sql
# backend/db/migrations/004_hybrid_law_chunks.sql
# backend/db/migrations/005_financials.sql

# 3. 컨테이너 실행
docker-compose up --build

# API 서버: http://localhost:8000
# API 문서: http://localhost:8000/docs
# 프론트엔드: http://localhost:3000

# 4. 프론트엔드 개발 서버 (단독 실행)
cd frontend && npm install && npm run dev
```

---

## 프로젝트 구조

```
BOSS/
├── frontend/                # Next.js 14 (웹/앱 공용)
│   ├── app/
│   │   ├── auth/            # 로그인 / 회원가입
│   │   ├── dashboard/       # 대시보드
│   │   │   ├── page.tsx     # 메인 대시보드
│   │   │   ├── sales/       # 매출 입력·조회
│   │   │   ├── insights/    # AI 인사이트
│   │   │   ├── tax/         # 세금 기한 + 부가세 신고서
│   │   │   ├── rag/         # 법령 검색
│   │   │   └── notifications/ # 알림 이력
│   │   ├── location/        # 입지분석 페이지
│   │   ├── onboarding/      # 4단계 창업자 등록 위저드
│   │   └── page.tsx         # 랜딩 페이지
│   ├── components/
│   │   ├── location/        # DistrictSelector / LlmReportPanel / 차트 컴포넌트
│   │   ├── onboarding/      # Step1~4 / StepIndicator
│   │   ├── rag/             # ResultCard / LlmSummaryPanel
│   │   └── tax/             # TaxDeadlineList
│   └── lib/
│       └── supabase.ts      # Supabase 클라이언트
├── backend/
│   ├── api/                 # FastAPI 서버
│   │   ├── main.py
│   │   ├── routers/         # founders / triggers / drafts / subsidies / tax / location / sales / insights / rag
│   │   └── schemas/         # Pydantic 스키마
│   ├── agents/
│   │   ├── orchestrator.py  # LangGraph 오케스트레이터 + 상태머신
│   │   ├── subsidy.py       # 지원사업 에이전트
│   │   ├── tax.py           # 세금/일정 에이전트
│   │   ├── location.py      # 마포구 입지분석 에이전트
│   │   └── hiring.py        # 채용/서류 에이전트
│   ├── analysis/
│   │   └── simulator.py     # 입지 시뮬레이션 엔진 (5개 지표 + 위험도 등급)
│   ├── core/
│   │   ├── config.py        # pydantic-settings 환경 변수
│   │   └── constants.py     # 업종·단계·마포구 상수
│   ├── db/
│   │   ├── client.py        # Supabase 클라이언트
│   │   └── migrations/      # SQL 마이그레이션 001~005
│   ├── notifications/
│   │   ├── email.py         # 이메일 알림
│   │   ├── kakao.py         # 카카오톡 알림
│   │   └── realtime.py      # Supabase Realtime 알림
│   ├── rag/
│   │   ├── ingest.py        # 문서·법령 청킹 → 임베딩 → Supabase
│   │   ├── embeddings/      # BGE-M3 (로컬) + OpenAI 임베딩
│   │   └── retriever/       # pgvector 유사도 검색
│   ├── tax/
│   │   ├── vat_calculator.py  # 간이/일반과세자 부가세 계산 엔진
│   │   ├── pdf_generator.py   # 국세청 서식 PDF 좌표 오버레이 (PyMuPDF)
│   │   ├── hometax_guide.py   # 홈택스 단계별 입력 가이드 생성
│   │   └── forms/             # 국세청 공식 서식 PDF 저장소
│   ├── triggers/
│   │   ├── scheduler.py     # APScheduler 시간 기반 트리거
│   │   ├── state.py         # 상태 전이 트리거
│   │   ├── inference.py     # LLM 추론 기반 트리거
│   │   └── hiring_inference.py  # 채용 전용 추론 트리거
│   ├── data/
│   │   ├── crawlers/        # 기업마당 / 골목상권 / 법제처 / 세금달력 / 서울 열린데이터
│   │   ├── parsers/         # PDF 파싱
│   │   └── seeds/           # 세금 기한 / 재무 mock / 마포 카페 통계
│   └── scripts/             # 규제법령 임베딩 / 마포 통계 시드 스크립트
├── backtest/
│   └── evaluate.py          # Precision/Recall 백테스트
├── docs/                    # 창업/운영/채용/폐업 표준서식 PDF
├── docker-compose.yml
├── .env.example
├── CLAUDE.md
└── README.md
```

---

## 팀

AI 심화과정 조별과제 | 2026

---

> ⚠️ 본 서비스가 제공하는 세금·법률·계약 관련 정보는 참고용이며,  
> 실제 신고 및 계약 전 반드시 전문가 확인을 권장합니다.

---

## 트러블슈팅

### 법령 검색 카테고리 필터가 0건을 반환하는 문제 (v0.4.3 수정)

**증상**
`/dashboard/rag`에서 `세금` 카테고리를 선택하고 `부가가치세`로 검색하면 결과가 하나도 나오지 않음. 카테고리 없이 검색해도 동일 쿼리에 4건만 반환되는 등 결과가 비정상적으로 적음.

**원인 — 2가지 이슈가 중첩**

1. **PostgREST vector 파라미터 직렬화 실패**
   Python `list[float]`을 `supabase.rpc("hybrid_search", {"query_embedding": [...]})`로 전달하면 PostgREST가 `vector(1024)` 타입으로 **자동 변환하지 못하고 NULL로 바인딩**됨. 에러 없이 조용히 실패하고 `embedding <=> NULL = NULL`이 되어 WHERE 절이 전부 false 처리.

2. **ivfflat 인덱스의 `probes` 문제**
   `law_chunks_embedding_idx`가 `ivfflat (lists=100)` 이었고, 기본 `probes=1`은 **100개 클러스터 중 1개만 탐색**. 쿼리 벡터와 가장 가까운 1개 클러스터에 tax 문서가 하나도 없으면 `category='tax'` 필터는 0건 반환. 데이터가 3000~5000행 규모로 작을수록 클러스터 불균형에 취약.

**해결**

- **벡터 파라미터를 text로 전달 + 함수 내부에서 캐스팅**

  ```sql
  -- 008_fix_vector_text_param
  CREATE OR REPLACE FUNCTION hybrid_search(
    query_text text,
    query_embedding text,          -- vector → text 로 변경
    match_count integer DEFAULT 10,
    filter_category text DEFAULT NULL,
    rrf_k integer DEFAULT 60,
    min_score double precision DEFAULT 0.3
  ) ... AS $$
    WITH q AS (SELECT query_embedding::vector AS vec)
    SELECT ... FROM law_chunks lc, q
    WHERE 1 - (lc.embedding <=> q.vec) >= min_score
    ...
  $$;
  ```

  ```python
  # backend/rag/retriever/pgvector_retriever.py
  embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
  supabase.rpc("hybrid_search", {"query_embedding": embedding_str, ...})
  ```

- **ivfflat → HNSW 인덱스 교체**

  ```sql
  -- 009_fix_ivfflat_index
  DROP INDEX IF EXISTS law_chunks_embedding_idx;

  CREATE INDEX law_chunks_embedding_idx
    ON law_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  ```

  HNSW는 그래프 기반 ANN으로 카테고리 필터 같은 제한된 검색에서도 안정적인 recall을 보장하며, 수천~수만 행 규모에서 ivfflat 보다 정확도·일관성이 우수.

**학습 포인트**

- Supabase RPC에 `vector` 파라미터를 넘길 땐 **항상 `"[v1,v2,...]"` 텍스트 포맷으로 전달**하고 함수 내부에서 `::vector` 캐스팅.
- 소규모 데이터(수천 행)에는 `ivfflat (lists=100)` 보다 **HNSW가 기본값으로 안전**. ivfflat을 쓸 거면 `SET LOCAL ivfflat.probes = 10` 같은 튜닝이 필수.
- 카테고리 필터 같은 pre-filter 가 붙는 벡터 검색은 IVF 계열의 cluster miss에 취약하니 HNSW 권장.

### 법령 카테고리 체계 정리 (v0.4.3)

기존에는 인허가성 법령(식품위생법·소방법·건축법)이 모두 `REGULATION` 카테고리로 저장되어 프론트 `license` 버튼이 항상 0건을 반환했음. 실제 인허가 단계의 법령은 `LICENSE`로, 운영 중 지속 규제(개인정보보호법)는 `REGULATION`으로 분리 재수집.

재수집 명령:

```bash
python -m backend.scripts.ingest_laws                  # 전체 재수집
python -m backend.scripts.ingest_laws --category license
python -m backend.scripts.ingest_laws --category regulation
```
