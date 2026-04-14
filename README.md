# BOSS

### Business Operations Support System

> 서울 F&B 소상공인을 위한 Proactive AI 비서

[![version](https://img.shields.io/badge/version-0.6.0-blue.svg)](https://semver.org)
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
- 데이터 소스: 서울 열린데이터 `VwsmAdstrdStorW`(상가업소 현황) + `VwsmAdstrdFlpopW`(유동인구) + 마포구 개폐업 통계
- 5개 지표: 포화도 지수 / 예상 월매출 / 손익분기(BEP) / 생존율 / 성장 잠재력
- 상권별 위험도 등급 (LOW / MED / HIGH)
- Claude LLM 기반 종합 해석 리포트
- 분석 결과 7일 캐시 (Supabase `location_reports`)
- 레이더 차트·생존율 바 차트 시각화
- 검색 이력 자동 저장 및 원클릭 재실행

### 3. 지원사업 모니터링 (v0.6.0 — 캘린더 + 하이브리드 검색)

- 기업마당 공공 API(`crtfcKey`/`jsonArray`) 기반 스냅샷 수집 — 대분류 "창업" 필터 (약 90여 건)
- **FullCalendar 기반 구글 캘린더 스타일** 월간 뷰 (데스크탑) + `listMonth` (모바일)
- **누적형 지역 필터** — 숨김 → 마포구 → `+ 서울` → `+ 전국` 순으로 확장
- 기간 파싱 불가 공고 ("예산 소진시까지" 등) 는 별도 **상시 모집 섹션** 으로 분리
- 페이지 진입 시 `subsidy_fetch_log(fetch_date PK)` 선점으로 하루 1회 증분 동기화
- **공고 전용 하이브리드 검색** — `subsidy_programs.embedding(vector 1024)` + FTS + `pg_trgm` 3-way RRF (`search_subsidies` RPC)

### 4. 세금 · 행정 관리

- 부가세(1/25, 7/25) · 종합소득세(5월) · 원천세(매월 10일) 기한 관리
- APScheduler 기반 D-14/D-7/D-1 선제 알림
- **부가가치세 신고서 자동 생성** — 간이/일반과세자 자동 분기
  - 국세청 공식 서식 PDF (별지 제44호·제21호) PyMuPDF 좌표 오버레이
  - 매출 데이터 자동 집계 → 세액 계산 → PDF 채우기 → Supabase Storage 저장
  - 홈택스 단계별 입력 가이드 자동 생성
  - 공식 서식 없을 경우 ReportLab 한글 CID 폰트 폴백

### 5. 서류 초안 PDF 좌표 오버레이 (4종)

- **PyMuPDF 기반 좌표 오버레이** — `/drafts/[type]` UI + `/pdf-forms` API
- 지원 서식: 사업자등록신청서 · 식품영업신고서 · 표준근로계약서 · 상가임대차계약서
- 필드 입력 → 실시간 PDF 오버레이 → 클라이언트 다운로드
- 공식 서식 그대로 사용하므로 관공서 제출 시 재편집 불필요

### 6. 채용 자동화

- LLM 추론 트리거: 운영 기간·매출 패턴·메뉴 수를 분석해 채용 적기 판단
- 개강시즌(3/9월) D-30, 연말 성수기(12월) D-45 선제 알림
- 잡코리아·알바천국·당근알바 형식 공고 초안 자동 생성
- 고용노동부 표준 근로계약서 초안 + 주휴수당 자동 계산

### 7. 매출 관리 & AI 인사이트

- 일별 매출 입력 (카테고리: 음료/디저트/기타 · 시간대: 오전/오후/저녁)
- 매출 합계 / 카테고리별·시간대별 분석
- 피크 시간대 자동 감지 → 채용 추론 신호로 활용
- **마포구 카페 벤치마크 비교** — 실데이터 기반 RAG 인사이트 (전년 동월 대비, 상권 평균 대비)
- **인사이트 데이터 확장 (v0.5.0)** — 공휴일(`holidays.json`) · 기상청 · 마포구 유동인구 · 개폐업 통계 크롤러 추가
- 서울 열린데이터 기반 상권 통계 자동 업데이트

### 8. 법령 RAG 검색 (3-way 하이브리드)

- 법제처 Open API → 식품위생법 등 규제법령 계층적 청킹 (조문·항 2단계)
- BGE-M3 (1024차원) 로컬 임베딩 → Supabase pgvector (HNSW 인덱스)
- **3-way RRF 하이브리드 검색 (v0.5.0)**
  - 벡터 유사도 + FTS(`simple`) + **`pg_trgm` word_similarity**
  - 한국어 복합어 대응 (`"최저임금"` ↔ `"최저임금법"` 매칭)
  - `char_length > 40` 필터 — 제목만 있는 조문 청크 제외
  - 응답에 RRF `score`(정렬용)와 실제 코사인 `similarity`(사용자 표시용) 분리 반환
- Claude LLM 기반 검색 결과 요약 + 법령 브리프
- 프론트 마크다운 렌더 (`react-markdown` + `remark-gfm` + `@tailwindcss/typography`)

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
         │  공휴일 · 기상 · 유동인구 │
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
| Google Gemini                  | 보조 LLM (멀티 LLM 실험) — `backend/agents/gemini.py`    |
| LangGraph                      | 상태머신 + 멀티에이전트 오케스트레이션                   |
| LangChain                      | RAG 파이프라인, 에이전트 체인 구성                       |

### RAG / 임베딩 / 검색

| 기술                                | 용도                                              |
| ----------------------------------- | ------------------------------------------------- |
| Supabase pgvector                   | 벡터 DB — HNSW 인덱스(`m=16, ef_construction=64`) |
| pg_trgm                             | Trigram GIN 인덱스 — 한국어 복합어 대응           |
| BAAI/bge-m3 (sentence-transformers) | 문서 임베딩 (1024차원, 로컬 GPU/CPU)              |
| OpenAI text-embedding-3-small       | 폴백 임베딩 (1536차원)                            |
| 3-way RRF Hybrid Search             | 벡터 + FTS(`simple`) + `word_similarity` RRF 결합 |
| LlamaIndex                          | 문서 파싱 + 청킹 + 인덱싱                         |

### 데이터 수집

| 기술                            | 용도                                   |
| ------------------------------- | -------------------------------------- |
| Python requests / BeautifulSoup | 기업마당 API 연동, 크롤링              |
| 법제처 Open API                 | 규제법령 RAG 문서 수집 (계층 청킹)     |
| 서울 열린데이터 API             | 상가업소·유동인구·골목상권·개폐업 통계 |
| 공공데이터포털 특일정보 API     | 공휴일 데이터                          |
| 기상청 단기예보 API             | 기상 데이터 (인사이트 보정용)          |
| PyMuPDF (fitz)                  | 정부 표준서식 PDF 파싱 + 좌표 오버레이 |

### 백엔드

| 기술        | 용도                               |
| ----------- | ---------------------------------- |
| FastAPI     | REST API 서버                      |
| APScheduler | Proactive 트리거 스케줄러          |
| Pydantic v2 | 스키마 + 환경변수 설정             |
| PyMuPDF     | 국세청·정부 서식 PDF 좌표 오버레이 |
| ReportLab   | 폴백 PDF 생성 (한글 CID 폰트)      |
| pdfplumber  | PDF 텍스트 파싱                    |

### 데이터베이스 (Supabase 유료)

| 기술                | 용도                                                     |
| ------------------- | -------------------------------------------------------- |
| Supabase PostgreSQL | 창업자 프로파일·상태·매출·재무·공휴일·기상·유동인구 저장 |
| Supabase pgvector   | 법령·공고 문서 벡터 저장 및 하이브리드 유사도 검색       |
| Supabase Realtime   | 트리거 알림 실시간 스트리밍                              |
| Supabase Storage    | 생성된 서류 초안 파일 저장                               |
| Supabase Auth       | 사용자 인증 / 세션 관리                                  |

### 프론트엔드

| 기술                        | 용도                                  |
| --------------------------- | ------------------------------------- |
| Next.js 14 (App Router)     | 웹 / 앱 공용 프론트엔드               |
| TypeScript                  | 타입 안전성                           |
| Tailwind CSS                | 스타일링                              |
| @tailwindcss/typography     | Claude 마크다운 브리프 프로즈 렌더링  |
| react-markdown + remark-gfm | 법령 브리프 마크다운 렌더             |
| Recharts                    | 입지분석 레이더 차트 · 생존율 바 차트 |
| pdfjs-dist + html2pdf.js    | 클라이언트 PDF 오버레이·다운로드      |
| PWA (Progressive Web App)   | 모바일 앱 대응                        |

### 인프라

| 기술                    | 용도            |
| ----------------------- | --------------- |
| Docker / Docker Compose | 컨테이너화      |
| GitHub Actions          | CI/CD           |
| Vercel                  | 프론트엔드 배포 |

---

## API 엔드포인트

| 메서드 | 경로                                | 설명                                               |
| ------ | ----------------------------------- | -------------------------------------------------- |
| GET    | `/health`                           | 서버 상태 확인                                     |
| POST   | `/founders`                         | 창업자 프로파일 생성                               |
| GET    | `/founders/{id}`                    | 창업자 정보 조회                                   |
| GET    | `/founders/me/state`                | 창업자 상태머신 조회                               |
| GET    | `/location/districts`               | 마포구 분석 가능 상권 목록                         |
| POST   | `/location/analyze`                 | 상권 비교 분석 실행 (7일 캐시)                     |
| GET    | `/location/history`                 | 창업자 입지 검색 이력                              |
| POST   | `/sales`                            | 매출 데이터 입력                                   |
| GET    | `/sales`                            | 매출 내역 조회                                     |
| GET    | `/sales/summary`                    | 매출 요약 (카테고리·시간대별)                      |
| GET    | `/insights`                         | AI 인사이트 (전년 동월·상권 평균·공휴일·기상 보정) |
| GET    | `/subsidies`                        | 지원사업 목록                                      |
| GET    | `/tax/deadlines`                    | 세금 기한 조회                                     |
| POST   | `/tax/deadlines/sync`               | 세금 기한 공공데이터 동기화                        |
| POST   | `/tax/draft`                        | 세금 신고서 초안 생성 (체크리스트)                 |
| POST   | `/tax/vat-draft`                    | 부가가치세 신고서 PDF 생성 (국세청 서식)           |
| GET    | `/tax/vat-draft/{id}/download`      | 부가가치세 신고서 PDF 다운로드                     |
| GET    | `/tax/vat-draft/{id}/hometax-guide` | 홈택스 단계별 입력 가이드 조회                     |
| POST   | `/triggers/run`                     | 트리거 수동 실행                                   |
| GET    | `/drafts`                           | 생성된 서류 초안 목록                              |
| GET    | `/drafts/{id}/download`             | 초안 PDF 다운로드                                  |
| POST   | `/pdf-forms/fill`                   | 정부 표준서식 PDF 좌표 오버레이 (4종)              |
| GET    | `/pdf-forms/templates`              | 지원 서식 목록 및 필드 스키마                      |
| POST   | `/rag/ingest/all`                   | docs/ 전체 문서 pgvector 수집                      |
| POST   | `/rag/ingest/file`                  | 특정 파일 pgvector 수집                            |
| POST   | `/rag/search`                       | 법령 하이브리드 검색 (3-way RRF)                   |
| POST   | `/rag/summarize`                    | 검색 결과 Claude 요약 (마크다운 브리프)            |
| GET    | `/rag/stats`                        | 카테고리별 저장 문서 수                            |

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

| 경로                       | 설명                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| `/`                        | 랜딩 페이지 (Hero / Features / Scenario / Trigger / Stack / CTA)     |
| `/auth/login`              | 로그인 (Supabase Auth)                                               |
| `/auth/signup`             | 회원가입 (Supabase Auth)                                             |
| `/onboarding`              | 4단계 창업자 등록 위저드                                             |
| `/dashboard`               | 매출 통계 + AI 인사이트 대시보드                                     |
| `/dashboard/sales`         | 일별 매출 입력 및 내역 조회                                          |
| `/dashboard/insights`      | 전년 동월 대비·상권 평균·공휴일·기상 보정 AI 인사이트                |
| `/dashboard/tax`           | 세금 기한 목록 + 부가세 신고서 초안 생성                             |
| `/dashboard/rag`           | 법령 하이브리드 검색 (3-way RRF) + Claude 마크다운 브리프            |
| `/dashboard/profile`       | 창업자 정보 및 사업자 정보 관리                                      |
| `/dashboard/notifications` | 알림 이력                                                            |
| `/location`                | 마포구 입지분석 (상권 비교·차트·LLM 리포트)                          |
| `/drafts/[type]`           | 서류 초안 PDF 좌표 오버레이 폼 (사업자등록·식품영업·근로계약·임대차) |

---

## 버전 관리

[SemVer](https://semver.org) 형식을 따릅니다: `MAJOR.MINOR.PATCH`

| 버전       | 내용                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.1.0     | 백엔드 초기 구조, 메인 페이지, 대시보드/로그인/회원가입                                                                                                                                                                                              |
| v0.2.0     | 규제법령 RAG (법제처 + BGE-M3), 입지분석 시뮬레이션, 세금 스케줄링, 채용 자동화, Sales API                                                                                                                                                           |
| v0.3.0     | 창업자 온보딩 위저드 (4단계), 입지분석 UI (차트·리포트), 매출 입력 페이지, Supabase Auth 연동 완성                                                                                                                                                   |
| v0.3.1     | 입지분석 9개 상권 확대, 서울 열린데이터 API 전환, 검색 이력 UI, 인증 없이 분석 허용                                                                                                                                                                  |
| v0.3.2     | RAG API 라우터 추가 (ingest/search/summarize/stats), 세금 초안 PDF 다운로드 (ReportLab)                                                                                                                                                              |
| v0.4.0     | 부가가치세 신고서 국세청 공식 서식 PDF (PyMuPDF 좌표 오버레이), 매출 인사이트 강화, 법령 계층적 청킹, DB 마이그레이션 004·005                                                                                                                        |
| v0.4.1     | 창업자 상태머신 활성화 — `GET /founders/me/state`, 상태 전이 트리거 연결, 오케스트레이터 DB 로드, 사이드바 현재 단계 표시, 온보딩 필수 항목 최소화                                                                                                   |
| v0.4.2     | 서류 초안 폼 UI — PDF 오버레이 방식 4종 (사업자등록신청서·식품영업신고서·표준근로계약서·상가임대차계약서), 프로필 페이지 `/dashboard/profile`, 온보딩 UX 개선, html2pdf 클라이언트 사이드 출력                                                       |
| v0.4.3     | 법령 검색 카테고리 필터 버그 수정 — `hybrid_search` RPC 파라미터 `vector` → `text` 캐스팅, ivfflat → **HNSW** 인덱스 교체, 인허가 법령 `LICENSE`/`REGULATION` 카테고리 분리                                                                          |
| **v0.5.0** | **RAG 3-way RRF 하이브리드 검색 (`pg_trgm` 추가), 코사인 유사도/RRF score 분리 반환, 법령 브리프 마크다운 렌더, PDF 서식 좌표 오버레이 라우터(`pdf_forms.py`), 인사이트 데이터 확장(공휴일·기상·유동인구·개폐업 통계), Google Gemini 보조 에이전트** |

현재 버전: **`v0.5.0`**

전체 변경 이력은 [CHANGELOG.md](./CHANGELOG.md) 참조.

---

## 데이터 소스

| 데이터                  | 출처                                                 | 수집 방법                       |
| ----------------------- | ---------------------------------------------------- | ------------------------------- |
| 지원사업 공고           | 기업마당 공공API                                     | API 호출                        |
| 세금 신고 기한          | 국세청 홈택스                                        | 하드코딩 + 크롤링               |
| 창업 입지 데이터        | 서울 열린데이터 (VwsmAdstrdStorW · VwsmAdstrdFlpopW) | 서울 열린데이터 API             |
| 골목상권 통계           | 서울 열린데이터 골목상권 분석 서비스                 | 서울 열린데이터 API             |
| 마포구 개폐업 통계      | 서울 열린데이터 상권변화지표                         | CSV 파싱                        |
| 식품위생 인허가 절차    | 식품안전나라, 정부24                                 | 크롤링 + RAG 문서화             |
| 규제법령                | 법제처 Open API                                      | API 호출 + BGE-M3 임베딩 (계층) |
| 표준 근로계약서         | 고용노동부                                           | PDF 파싱                        |
| 표준 임대차계약서       | 법제처                                               | PDF 파싱                        |
| 최저임금 / 4대보험 요율 | 고용노동부, 건강보험공단                             | 하드코딩 (연 1회 갱신)          |
| 공휴일                  | 공공데이터포털 특일정보                              | API + 시드 JSON                 |
| 기상                    | 기상청 단기예보                                      | API + Supabase `weather`        |
| 마포구 유동인구         | 서울 열린데이터 상권별 유동인구                      | API 호출                        |

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

RAG 검색 품질 (v0.5.0 추가)
  벡터 단독 vs 3-way RRF → recall@5 / MRR 비교
```

---

## 빠른 시작

```bash
# 1. 환경 변수 설정
cp .env.example .env
# .env 에 Supabase / Anthropic / Gemini / 공공데이터 키 입력

# 2. DB 초기화 (Supabase SQL Editor에서 순서대로 실행)
# backend/db/migrations/001_initial.sql
# backend/db/migrations/002_location.sql
# backend/db/migrations/002_tax_deadlines.sql
# backend/db/migrations/003_bge_m3_dimension.sql
# backend/db/migrations/004_hybrid_law_chunks.sql
# backend/db/migrations/005_financials.sql
# backend/db/migrations/006_fix_hybrid_search.sql
# backend/db/migrations/007_law_chunks_table.sql
# backend/db/migrations/008_fix_vector_text_param.sql
# backend/db/migrations/009_fix_ivfflat_index.sql
# backend/db/migrations/010_weather.sql
# backend/db/migrations/011_hybrid_search_cosine_similarity.sql
# backend/db/migrations/012_hybrid_search_trigram.sql

# 3. 법령 / 통계 시드
python -m backend.scripts.ingest_laws
python -m backend.scripts.seed_holidays
python -m backend.scripts.seed_weather
python -m backend.scripts.seed_mapo_population
python -m backend.scripts.seed_commercial_change
python -m backend.scripts.seed_mapo_stats

# 4. 컨테이너 실행
docker-compose up --build

# API 서버: http://localhost:8000
# API 문서: http://localhost:8000/docs
# 프론트엔드: http://localhost:3000

# 5. 프론트엔드 개발 서버 (단독 실행)
cd frontend && npm install && npm run dev
```

---

## 프로젝트 구조

```
BOSS/
├── frontend/                      # Next.js 14 (웹/앱 공용)
│   ├── app/
│   │   ├── auth/                  # 로그인 / 회원가입
│   │   ├── dashboard/
│   │   │   ├── page.tsx           # 메인 대시보드
│   │   │   ├── sales/             # 매출 입력·조회
│   │   │   ├── insights/          # AI 인사이트
│   │   │   ├── tax/               # 세금 기한 + 부가세 신고서
│   │   │   ├── rag/               # 법령 하이브리드 검색
│   │   │   ├── profile/           # 창업자·사업자 정보 관리
│   │   │   └── notifications/     # 알림 이력
│   │   ├── location/              # 입지분석 페이지
│   │   ├── onboarding/            # 4단계 창업자 등록 위저드
│   │   ├── drafts/[type]/         # PDF 좌표 오버레이 폼 (4종)
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
│   │   ├── routers/               # health / founders / triggers / drafts / subsidies
│   │   │                          # / tax / location / sales / insights / rag / pdf_forms
│   │   └── schemas/
│   ├── agents/
│   │   ├── orchestrator.py        # LangGraph 상태머신
│   │   ├── subsidy.py
│   │   ├── tax.py
│   │   ├── location.py
│   │   ├── hiring.py
│   │   └── gemini.py              # Google Gemini 보조 에이전트
│   ├── analysis/
│   │   └── simulator.py           # 입지 시뮬레이션 엔진
│   ├── core/
│   │   ├── config.py
│   │   ├── constants.py
│   │   └── holidays.py            # 공휴일 유틸
│   ├── db/
│   │   ├── client.py
│   │   └── migrations/            # 001~012 SQL 마이그레이션
│   ├── notifications/             # email / kakao / realtime
│   ├── rag/
│   │   ├── document_loader.py
│   │   ├── ingest.py
│   │   ├── embeddings/            # BGE-M3 + OpenAI 폴백
│   │   └── retriever/
│   │       └── pgvector_retriever.py  # 3-way RRF
│   ├── tax/
│   │   ├── vat_calculator.py
│   │   ├── pdf_generator.py
│   │   ├── hometax_guide.py
│   │   └── forms/                 # 국세청 공식 서식 PDF
│   ├── triggers/                  # scheduler / state / inference / hiring_inference
│   ├── data/
│   │   ├── crawlers/              # bizinfo / law_api / seoul_open / alley
│   │   │                          # / tax_calendar / holiday / weather / mapo_population
│   │   ├── parsers/               # pdf_parser / commercial_change_parser
│   │   └── seeds/                 # holidays.json / mapo_stats.json / commercial_change/
│   └── scripts/                   # ingest_docs / ingest_laws / seed_*
├── backtest/
│   └── evaluate.py
├── scripts/
│   └── test_pdf_fill.py           # PDF 좌표 오버레이 테스트
├── docs/                          # 표준서식 PDF + feature-9-10-analysis.md
├── docker-compose.yml
├── .env.example
├── CHANGELOG.md
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

### RAG 유사도가 항상 "3%"처럼 표시되던 문제 (v0.5.0 수정)

**증상**
법령 검색 결과 카드에 유사도가 3%대로만 나옴. 실제로는 관련도 높은 문서임.

**원인**
`hybrid_search`가 반환하던 `score`는 RRF(Reciprocal Rank Fusion) 점수로 `rrf_k=60` 기준 최댓값이 약 `0.033`(≈3.3%). 프론트에서 `× 100`을 해도 항상 3%대로 표시되는 구조.

**해결** — `migrations/011_hybrid_search_cosine_similarity.sql`

- `score`(RRF, 정렬용)와 `similarity`(실제 코사인 유사도 %, 표시용) 컬럼 분리
- 프론트는 `similarity`를 사용자 지표로 표시

### 한국어 복합어 검색이 0건 반환되던 문제 (v0.5.0 수정)

**증상**
`"최저임금"`으로 검색하면 `"최저임금법"` 문서가 매칭되지 않음. 하이브리드 검색이 벡터 단독 검색으로 퇴화.

**원인**
PostgreSQL `simple` FTS 토크나이저가 한국어 복합어를 분리하지 못해 `plainto_tsquery('simple', '최저임금')`가 `'최저임금법'` 문서와 매칭되지 않음.

**해결** — `migrations/012_hybrid_search_trigram.sql`

- `pg_trgm` GIN 인덱스(`gin_trgm_ops`) 추가
- `word_similarity(query_text, lc.content)` 기반 trigram 랭커를 3번째 RRF 성분으로 추가
- `word_similarity`는 content 내 쿼리와 가장 유사한 구간 점수화 → 긴 본문 속 부분 매칭도 고점 가능
- 동시에 `char_length(content) > 40` 필터로 제목만 있는 조문 청크 제외

**학습 포인트**

- 한국어 FTS는 `simple` 토크나이저만으로는 부족 — trigram 보조 필수
- 3-way RRF는 각 랭커의 약점을 상호 보완 (벡터: 의미 / FTS: 정확 일치 / trigram: 부분 문자열)

### 법령 검색 카테고리 필터 0건 문제 (v0.4.3 수정)

**원인** — 2가지 이슈 중첩

1. **PostgREST vector 파라미터 직렬화 실패** — Python `list[float]`이 `vector(1024)`로 자동 변환되지 못하고 NULL 바인딩
2. **ivfflat 인덱스 `probes=1` 문제** — 100개 클러스터 중 1개만 탐색해 카테고리 pre-filter 시 cluster miss

**해결**

- `008_fix_vector_text_param.sql` — `query_embedding text` 받고 함수 내부에서 `::vector` 캐스팅
- `009_fix_ivfflat_index.sql` — ivfflat → HNSW (`m=16, ef_construction=64`)

```python
# backend/rag/retriever/pgvector_retriever.py
embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
supabase.rpc("hybrid_search", {"query_embedding": embedding_str, ...})
```

### 법령 카테고리 체계 정리 (v0.4.3)

기존에는 인허가성 법령(식품위생법·소방법·건축법)이 모두 `REGULATION`으로 저장되어 프론트 `license` 버튼이 항상 0건. 인허가 단계 법령은 `LICENSE`로, 운영 중 지속 규제(개인정보보호법)는 `REGULATION`으로 분리 재수집.

재수집 명령:

```bash
python -m backend.scripts.ingest_laws                  # 전체 재수집
python -m backend.scripts.ingest_laws --category license
python -m backend.scripts.ingest_laws --category regulation
```
