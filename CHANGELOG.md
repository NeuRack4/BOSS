# Changelog

BOSS 버전 이력입니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 규약을 따르며, 버전 번호는 [SemVer](https://semver.org) 형식입니다.

---

## [v0.15.2] — 2026-04-16

### 기능 — 챗봇 실시간 도구 상태 표시 + 15턴 컨텍스트 통일

#### Added

- **실시간 도구 실행 상태 메시지** (`frontend/app/api/chat/route.ts`, `frontend/components/chat/ChatWindow.tsx`)
  - 도구 호출 전 즉시 SSE 스트림 시작 — 클라이언트에 실시간 상태 전달
  - `{"type":"status","text":"..."}` 이벤트로 단계별 상태 표시:
    - 질문 수신 → `"질문 분석 중..."`
    - 도구 선택 → `"📚 법령 DB 검색 중..."` / `"📢 지원사업 조회 중..."` 등 도구별 메시지
    - 2차 호출 직전 → `"답변 생성 중..."`
    - 첫 텍스트 수신 시 상태 메시지 자동 소거
  - 기존 블라인드 setTimeout 타이머 제거 → 실제 서버 단계에 동기화

#### Changed

- **히스토리 컨텍스트 15턴 통일** (발표자료 기준)
  - `route.ts`: `history.slice(-10)` → `history.slice(-30)` (30개 = 15턴)
  - `ChatWindow.tsx`: `messages.slice(-20)` → `messages.slice(-30)` (30개 = 15턴)
  - `agent.ts`: `history.slice(-10)` → `history.slice(-30)` (30개 = 15턴)
  - 추가 비용: haiku 기준 약 $0.00016/요청 (무시 가능)

- **테스트 하네스 결과 파일명** (`frontend/scripts/test_harness.ts`)
  - `YYYYMMDD` → `YYYYMMDD-HHMMSS` 형식 — 같은 날 실행해도 덮어쓰지 않고 누적 저장

---

## [v0.15.1] — 2026-04-16

### 수정 — 챗봇 응답 속도 + 테스트 하네스 채점 로직 개선

#### Fixed

- **`tool_choice: "any"` → `"auto"` 변경** (`frontend/app/api/chat/route.ts`)
  - 기존: Claude가 모든 질문에 무조건 도구 호출 강제 → 불필요한 RAG 검색으로 응답 지연
  - 변경: Claude가 필요한 경우에만 도구 선택 → 단순 질문 직답 가능, 평균 응답 속도 개선

- **테스트 하네스 채점 로직 수정** (`frontend/scripts/test_harness.ts`)
  - 기존: Claude 최종 응답에서 `【법령 N】` 포맷 마커 탐색 → 실제론 Claude가 자연어로 재작성하므로 전부 0점 오채점
  - 변경: 응답 텍스트 내 **간접 증거 패턴** (법령 조항 번호 `/제\d+조/`, 구체적 날짜 `/\d{4}년 \d+월 \d+일/`, 마포구 상권명 등)으로 도구 호출 여부 판정
  - 채점 신뢰도 대폭 향상

---

## [v0.15.0] — 2026-04-16

### 기능 — 챗봇 테스트 하네스 + 프로필 컨텍스트 주입 + LangChain 마이그레이션

#### Added

- **챗봇 자동 테스트 하네스** (`frontend/scripts/test_harness.ts`)
  - 5개 시나리오(식품위생·지원사업·세금기한·입지·근로계약) 자동 평가
  - 도구 호출 정확도(40점) + 키워드 포함(40점) + 응답시간(20점) 채점
  - v1/v2 비교 지원 — `docs/chatbot-test-results-YYYYMMDD.md` 자동 저장
  - 실행: `npx tsx scripts/test_harness.ts` (Next.js dev server 필요)

- **LangChain Tool 정의** (`frontend/lib/chatbot/tools.ts`)
  - 5개 도구를 LangChain `tool()` 포맷 + zod 스키마로 정의
  - 기존 `executeTool()` 정규화 로직 그대로 재사용

- **LangChain AgentExecutor** (`frontend/lib/chatbot/agent.ts`)
  - `createReactAgent(llm, tools)` — 도구 루프 자동 처리
  - `runBossAgent()` — 스트리밍 ReadableStream 반환

- **챗봇 API v2** (`frontend/app/api/chat-v2/route.ts`)
  - LangChain 기반 `/api/chat-v2` 엔드포인트
  - 기존 `/api/chat` (raw fetch) 보존 — 비교 테스트 가능

#### Changed

- **프로필 컨텍스트 주입** (`frontend/app/api/chat/route.ts`)
  - `ChatRequest`에 `userId?` 필드 추가
  - `userId` 전달 시 Supabase에서 창업자 프로필 조회 → 시스템 프롬프트 동적 주입
  - 프로필 미전달 시 기존 동작 그대로 (fallback)
  - 토큰 영향: +50~80 토큰 / 요청 (캐싱 적용으로 실질 추가 비용 미미)

#### Dependencies

- `@langchain/anthropic ^1.3.26`, `@langchain/core ^1.1.40`, `@langchain/langgraph ^1.2.8`, `zod ^4.3.6` 추가

---

## [v0.14.2] — 2026-04-15

### 수정 — AI 챗봇 응답 정규화 + 로그 파일 저장

#### Fixed

- **API 응답 정규화** (`frontend/app/api/chat/route.ts`)
  - `executeTool()` 반환값을 raw JSON → Claude가 읽기 좋은 한국어 텍스트로 변환
  - `search_laws`: 【법령 N】출처 + 조항 + 본문 형식
  - `search_subsidies`: 【지원사업 N】제목·기관·마감·대상·설명 형식
  - `get_tax_deadlines`: 【세금 신고 기한 목록】날짜·제목·세금종류 형식
  - `get_ongoing_subsidies`: 【상시 모집 지원사업】번호·제목·기관·대상 형식
  - `get_location_districts`: 【마포구 9개 상권 정보】상권명·점수·설명 형식
- **챗봇 로딩 dots 중복 버그 수정** (`frontend/components/chat/ChatWindow.tsx`)
  - 빈 content + isStreaming 상태에서 dots가 두 개 렌더링되던 문제 해결
  - dots를 MessageBubble 내부로 이동, 별도 로딩 div 제거

#### Added

- **[CHATBOT] 콘솔 로그** — 툴 선택·입력값·성공/실패를 터미널에 출력
- **챗봇 로그 파일 저장** (`frontend/logs/chatbot.log`)
  - 타임스탬프 포함 자동 저장 — `tail -f frontend/logs/chatbot.log`로 실시간 확인 가능

---

## [v0.14.1] — 2026-04-15

### 문서 — 챗봇 환경변수 템플릿 추가

#### Added

- **프론트엔드 환경변수 템플릿** (`frontend/.env.local.example`)
  - 챗봇 실행에 필요한 `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` 명시
  - Supabase, SMTP 등 프론트엔드 전체 환경변수 가이드 포함
  - 팀원 로컬 환경 세팅 가이드용 — 실제 키값 미포함

---

## [v0.14.0] — 2026-04-15

### 기능 — 채용 관리 (`/dashboard/hire`)

#### Added

- **채용 관리 라우터** (`backend/api/routers/hire.py`) — 신규 파일
  - `GET /hire/status` — 창업자 프로파일·매출 요약·계절 채용 신호
  - `POST /hire/inference` — AI 채용 타이밍 분석 (LLM 추론 기반)
  - `POST /hire/job-posting` — 채용공고 초안 3플랫폼 (당근마켓·알바천국·사람인)
  - `POST /hire/job-posting-visual` — Claude Haiku HTML 디자인 채용공고 생성
  - `POST /hire/labor-contract` — 고용노동부 표준 근로계약서 초안
  - `GET /hire/wage-simulation` — 인건비 시뮬레이션 (주휴수당 + 4대보험 의무 여부)
- **채용 에이전트 확장** (`backend/agents/hiring.py`)
  - `generate_job_posting_draft(ctx, extra)` — 15개 필드 풍부한 컨텍스트 프롬프트
  - `generate_job_posting_visual(job_data, style_prompt)` — Claude Haiku HTML 디자인, regex 펜스 제거
  - 2026년 최저임금 10,320원 적용 (`MIN_WAGE_2025 = 10_320`)
- **채용 페이지** (`frontend/app/dashboard/hire/page.tsx`) — 신규 파일
  - 3탭 자유 이동: 채용 현황 / 채용공고 작성 / 근로계약서
  - **채용 현황 탭**: 단계·오픈 개월·직원 수 카드, 3개월 매출 요약, 계절 채용 신호 배너, AI 분석 버튼
  - **채용공고 작성 탭**: 15개 필드 폼 (카페 정보·근무조건·모집정보·복리후생), 체크박스 멀티셀렉트 + 자유 입력, 텍스트 초안 3플랫폼 탭, HTML 디자인 미리보기 + PDF 다운로드
  - **필수 항목 유효성 검사**: 카페 상호명·근무지 주소·근무 요일·근무 기간·주요 업무 미입력 시 버튼 비활성화 + 인라인 에러 표시
  - **근로계약서 탭**: 주 근무시간·시급 입력 → 표준 계약서 초안 생성·복사
  - DB 카페 정보 자동 프리필 (`/hire/status` 연동)
  - `html2pdf.js` 동적 import — A4 portrait, scale 2
- **버전 동적 연동** (`frontend/lib/version.ts`) — 신규 파일
  - `APP_VERSION` 상수 단일 관리, `layout.tsx` import로 사이드바 버전 자동 반영

#### Changed

- **사이드바** (`frontend/app/dashboard/layout.tsx`)
  - "채용 공고" 메뉴 추가 (`/dashboard/hire`, Users 아이콘)
  - 하드코딩 `v0.6.0` → `v{APP_VERSION}` 동적 렌더링
- **백엔드 진입점** (`backend/api/main.py`)
  - `hire` 라우터 등록 (`prefix="/hire"`)

#### Fixed

- `backend/triggers/state.py` — `_insert_trigger_log` 함수 누락으로 발생하던 ImportError 해결
- `_get_founder_profile` — `maybe_single()` 204 오류 → `.limit(1).execute()` 패턴으로 전환
- `users.district` 컬럼 없음 오류 → `users.region` 조회로 수정

---

### 기능 — BOSS 도메인 특화 에이전틱 AI 챗봇

#### Added

- **챗봇 API Route** (`frontend/app/api/chat/route.ts`) — 신규 파일
  - Next.js 서버사이드 API Route — Anthropic API 키 서버 내 보호
  - **Claude Tool Use(Function Calling) 에이전틱 루프**: 1차 호출(툴 선택) → 병렬 툴 실행 → 2차 호출(SSE 스트리밍)
  - 5개 BOSS 도메인 툴 — 팀원 API를 읽기 전용으로 호출 (기존 백엔드 무수정)
    - `search_laws` → `POST /rag/search` — 법령·규정 하이브리드 검색 (법적 질문 시 항상 호출)
    - `search_subsidies` → `POST /subsidies/search` — 지원사업 공고 검색
    - `get_tax_deadlines` → `GET /tax/deadlines` — 세금 신고 기한 조회
    - `get_ongoing_subsidies` → `GET /subsidies/ongoing` — 상시 모집 지원사업
    - `get_location_districts` → `GET /location/districts` — 마포구 9개 상권 정보
  - 프롬프트 캐싱 (`cache_control: ephemeral`) — 시스템 프롬프트 캐시 적중 시 토큰 비용 90% 절감
  - `CLAUDE_MODEL` 환경변수 — `claude-haiku-4-5` 교체로 비용 ~84% 절감 가능
  - 슬라이딩 윈도우 컨텍스트 — 최근 20개 메시지만 유지 (컨텍스트 폭발 방지)
  - MAX_TURNS=15 하드 제한 — 대화 15턴 후 리셋 유도
  - **행동 중심 시스템 프롬프트**: 모든 응답 끝에 "사장님이 다음에 해야 할 구체적인 행동 1~3가지" 필수 포함
- **챗봇 UI 컴포넌트** (`frontend/components/chat/ChatWindow.tsx`) — 신규 파일
  - 실시간 SSE 스트리밍 텍스트 표시 (커서 애니메이션)
  - 턴 뱃지 (TurnBadge): 녹색→황색→적색 단계적 경고 (13/15턴부터 경고)
  - "새 대화 시작" 버튼 — 첫 턴 이후 헤더에 표시, 클릭 시 상태 초기화
  - 툴 실행 상태 표시 ("BOSS 데이터 조회 중..." — 에이전틱 루프 진행 중 표시)
  - 마크다운 렌더링 (ReactMarkdown + remark-gfm)
  - Shift+Enter 줄바꿈 / Enter 전송
- **챗봇 페이지** (`frontend/app/dashboard/chat/page.tsx`) — 신규 파일
  - `/dashboard/chat` 경로
  - "서류 초안 바로가기" 버튼 → `/drafts/business-registration`

#### Changed

- **사이드바** (`frontend/app/dashboard/layout.tsx`)
  - `navItems` 최하단에 "AI 챗봇" (`/dashboard/chat`, MessageCircle 아이콘) 메뉴 추가

#### Notes

- 신규 파일 3개 추가, 기존 팀원 파일 1개만 최소 수정 (navItems 1줄)
- `ANTHROPIC_API_KEY` 환경 변수 필요 (`frontend/.env.local`에 추가)
- 백엔드 API는 팀원 코드를 읽기 전용 호출만 — 팀원 파일 무수정

---

## [v0.13.2] — 2026-04-15

### 버그 수정

#### Fixed

- **매출 페이지 fetch 에러 핸들링** (`frontend/app/dashboard/sales/page.tsx`)
  - `fetchMenus` / `fetchEntries`에 try-catch 추가
  - 백엔드 미실행 또는 네트워크 오류 시 "Unhandled Runtime Error: TypeError: Failed to fetch" 오버레이 대신 조용히 처리

---

## [v0.13.1] — 2026-04-15

### 기능 — 사이드바 UX 개선

#### Changed

- **사이드바 고정** (`frontend/app/dashboard/layout.tsx`)
  - `md:static` → `fixed` 전환, 본문이 길어져도 사이드바 뷰포트에 고정
  - 네비게이션 영역에 `overflow-y-auto` 추가 — 메뉴 많아도 내부 스크롤
  - 메인 콘텐츠 `md:ml-60` 오프셋 추가
- **알림·마이페이지 버튼 이동** (`frontend/app/dashboard/layout.tsx`)
  - 사이드바 하단 navItems → 로고(BOSS) 우측 아이콘 버튼으로 이동
- **전체 아이콘 흑백 SVG 교체** (`frontend/app/dashboard/layout.tsx`)
  - 이모지/컬러 아이콘 → `lucide-react` 흑백 SVG 아이콘 일괄 교체
- **현재 단계 표시 형식 변경** (`frontend/app/dashboard/layout.tsx`)
  - 2줄 표시 → `창업 준비 (입지 탐색)` 한 줄 인라인 형식
  - 데이터 로딩 전 `—` 플레이스홀더로 레이아웃 고정 (높이 흔들림 제거)

---

## [v0.13.0] — 2026-04-15

### 기능 — AI 인사이트 마케팅 강화 및 마크다운 렌더링 수정

#### Added

- **순수 React 마크다운 파서** (`frontend/app/dashboard/insights/page.tsx`)
  - `Md` 컴포넌트: h1/h2/h3, bold/italic, ul/ol, hr을 라이브러리 없이 파싱
  - `inline()` 헬퍼: `**bold**`, `*italic*` 인라인 파싱
  - ReactMarkdown ESM 이슈 우회, `"use client"` 컴포넌트에서 안정적 동작

#### Changed

- **AI 분석 응답 품질** (`backend/api/routers/insights.py`)
  - `max_tokens` 1024/800 → 8000 상향 (응답 잘림 현상 해소)
  - 추천 액션: 마케팅 항목 필수 포함 — 플랫폼·요일·시간·해시태그 구체적 명시
  - 마케팅 제안: 채널 & 타이밍에 구체적 요일·시간대, 콘텐츠 방향에 실제 캡션 예시 추가
  - 모델 하드코딩 `"claude-sonnet-4-6"` → `get_settings().claude_model` 통일
- **면책고지 분리 로직 수정** (`frontend/app/dashboard/insights/page.tsx`)
  - 기존: `\n---\n` 기준 split → Claude가 `---` 섹션 구분자 사용 시 본문 전체가 disclaimer로 처리되는 버그
  - 수정: `"본 내용은 참고용"` 텍스트 위치 기준 분리
- **모델 설정 환경변수화** (`backend/core/config.py`)
  - `claude_model: str = "claude-haiku-4-5-20251001"` 추가 — `.env`로 모델 교체 가능
- **전체 에이전트 모델 통일** (`backend/agents/hiring.py`, `subsidy.py`, `subsidy_draft.py`, `tax.py`, `location.py`, `backend/api/routers/marketing.py`, `ocr.py`, `rag.py`, `backend/triggers/`)
  - 하드코딩된 모델명 → `get_settings().claude_model` 로 일괄 변경

---

## [v0.12.0] — 2026-04-15

### 기능 — 서울 전체 상권 ML 매출 예측 + 입지분석 고도화

#### Added

- **ML 매출 예측 모듈** (`backend/ml/`)
  - `features.py` — 상권 단위 피처 엔지니어링 (sbiz_tradearea 매출 레이블 + flpop 유동인구 → district_features)
  - `train.py` — RandomForest 기반 월 매출 예측 모델 학습 (개인 조건 + 상권 피처 5종)
  - `predict.py` — `predict_one()`: 개인 조건 + 상권 피처 → 실시간 매출 예측 / `predict_and_store()`: 전체 상권 배치 예측 → DB 저장
  - `zones.py` — 상권 유형별(골목·발달·전통·관광) 지역 영역 분석
  - `models/revenue_model.pkl` — 학습된 모델 (서울 전체 상권 기반)
- **데이터 파서 3종** (`backend/data/parsers/`)
  - `reb_parser.py` — 소상공인365 부동산 임대료 데이터 파서
  - `sbiz_parser.py` — 서울시 상권분석서비스 추정매출 파서 (OA-15572 / 15147229)
  - `transit_parser.py` — 지하철역·버스정류장 반경 접근성 파서
- **시드 데이터** (`backend/data/seeds/`)
  - `flpop/`, `sbiz/`, `reb/`, `transit/` 디렉토리 — 서울 전체 상권 데이터
  - `seoul_flpop_stats.parquet`, `seoul_store_stats.parquet` — 전처리 완료 파케이 파일
- **서울 전체 크롤러** (`backend/data/crawlers/seoul_open_full.py`)
  - 마포구 한정 → 서울 전체 25개 자치구 상권 데이터 수집 확장
- **DB 마이그레이션 5종** (`backend/db/migrations/`)
  - `017_seoul_open_cache.sql` — 서울 열린데이터 API 캐시 테이블
  - `018_seoul_raw_data.sql` — `seoul_store_stats` + `seoul_flpop_stats` + `sbiz_tradearea` 테이블
  - `019_district_features.sql` — 행정동별 ML 피처 테이블 (카페 현황·유동인구·접근성·임대료·레이블)
  - `020_location_sessions.sql` — 입지분석 개인화 세션 저장 테이블 (예산·조건·예측 결과)
  - `021_district_features_rename.sql` — 테이블 명칭 정비
- **입지분석 프론트엔드 컴포넌트 3종** (`frontend/components/location/`)
  - `AiRevenueChart.tsx` — 서울 전체 상권 AI 매출 예측 바 차트 (상권 유형별 컬러 구분)
  - `MapoDataViewer.tsx` — 마포구 9개 상권 상세 데이터 뷰어
  - `PersonalAnalysisForm.tsx` — 개인 조건 입력 폼 (좌석 수·영업시간·객단가·영업일)
- **입지분석 대시보드 페이지** (`frontend/app/dashboard/location/`)
  - `/location/` → `/dashboard/location/` 이동 (사이드바 통합)
  - 서울 전체 상권 AI 매출 예측 탭 추가
  - 개인 조건 입력 → 상권 맞춤 매출 예측 플로우
- **시드 스크립트** (`backend/scripts/seed_seoul_ml.py`)
  - 파케이 + CSV 시드 → `district_features` 테이블 일괄 적재

#### Changed

- **입지분석 에이전트** (`backend/agents/location.py`)
  - 서울 전체 상권 ML 예측 파이프라인 통합 (기존 마포구 시뮬레이션 유지 + ML 레이어 추가)
- **위치 라우터** (`backend/api/routers/location.py`)
  - 개인화 세션 저장/조회 엔드포인트 추가
  - `recommend` 라우터와 데이터 공유 구조 정비
- **상수** (`backend/core/constants.py`)
  - 서울 전체 자치구 코드 맵 추가 (25개 구)
- **사이드바** (`frontend/app/dashboard/layout.tsx`)
  - "입지 분석" 메뉴 경로 `/location` → `/dashboard/location` 업데이트

---

## [v0.11.0] — 2026-04-15

### 기능 — 메뉴 관리 · POS 파일 가져오기 · 메뉴별 AI 분석 · AI 인사이트 마케팅 섹션

#### Added

- **메뉴 관리 API** (`backend/api/routers/menus.py`)
  - `POST/GET/PUT/DELETE /menus/` — 메뉴 CRUD (카테고리·가격·이미지 URL 관리)
  - 메뉴판 OCR 연동: `POST /ocr/menu` 결과 → 메뉴 일괄 등록
- **매출 항목 API** (`backend/api/routers/sales_items.py`)
  - `POST /sales-items/` — 개별 트랜잭션 저장 (메뉴명·수량·단가·time_slot)
  - `GET /sales-items/monthly-summary` — 월별 메뉴별 집계
- **POS 파일 가져오기** (`backend/api/routers/ocr.py`)
  - `POST /ocr/sales-file` — CSV/Excel 업로드 → Claude API로 컬럼 자동 인식·매핑
  - 다국어 날짜 포맷 자동 파싱 (20240115 / 2024/01/15 / 2024년1월15일 등)
  - 시간대 5구간 매핑 (오전·점심·오후·저녁·마감)
  - EUC-KR / CP949 / UTF-8 인코딩 자동 감지, Excel `.xlsx/.xls` 지원
- **메뉴별 AI 분석** (`backend/api/routers/insights.py`)
  - `GET /insights/menu-analysis` — 월별 TOP 메뉴 집계 + Claude 추천 액션 생성
  - 데이터 없을 때도 `message` 필드로 안내 반환
- **영업 추천 API** (`backend/api/routers/recommend.py`)
  - `GET /recommend` — 자본금·업종·나이 기반 창업 추천 (capital: 1~1,000,000만원, age: 1~120세 검증)
- **입지 지도 API** (`backend/api/routers/map.py`)
  - `GET /map/districts` — 마포구 9개 상권 GeoJSON 데이터
- **메뉴 관리 페이지** (`frontend/app/dashboard/menus/page.tsx`)
  - 메뉴 등록·수정·삭제 UI
  - "📸 메뉴판 사진으로 등록" — 이미지 업로드 → OCR → 체크박스 선택 후 일괄 등록
- **입지 지도 페이지** (`frontend/app/dashboard/map/`)
  - 마포구 9개 상권 시각화
- **스타트업 온보딩 페이지** (`frontend/app/dashboard/startup/`)
  - 초기 창업 단계 안내
- **샘플 POS 파일 5종** (`docs/sample_pos_data/`)
  - `sample_1_cafe_pos_standard.csv` — 표준 POS 형식
  - `sample_2_toss_settlement.csv` — 토스페이먼츠 정산 형식
  - `sample_3_kiosk_english_header.csv` — 영문 헤더 키오스크
  - `sample_4_manual_excel_style.csv` — 수기 엑셀 8자리 날짜·시간대 텍스트
  - `sample_5_daily_summary_no_time.csv` — 일별 요약(한글 날짜·금액 따옴표)
- **`pandas>=2.2.0`, `openpyxl>=3.1.0`** (`backend/requirements.txt`) — Excel/CSV 파싱 의존성 추가

#### Changed

- **AI 인사이트 프롬프트** (`backend/api/routers/insights.py`)
  - 4섹션 구조 강제: `## 핵심 요약` / `## 원인 분석` / `## 추천 액션` / `## 마케팅 제안`
  - `## 마케팅 제안` 섹션에 추천 홍보 메뉴·채널·타이밍·콘텐츠 방향 필수 포함
- **인사이트 페이지** (`frontend/app/dashboard/insights/page.tsx`)
  - 탭 시스템 추가: "✦ AI 매출 분석" / "☕ 메뉴별 분석"
  - `InsightCard` 컴포넌트: 마케팅 제안 섹션을 오렌지 강조 카드로 분리 렌더링
  - 오렌지 카드 "콘텐츠 바로 만들기 →" 버튼 → `/dashboard/marketing` 딥링크
  - `parseInsight()` 제거 → `InsightMarkdown` 컴포넌트로 전체 교체
- **InsightMarkdown 컴포넌트** (`frontend/components/insights/InsightMarkdown.tsx`) 신규
  - `react-markdown` + `remark-gfm` + Tailwind `prose` 클래스 기반 마크다운 렌더링
  - `##` 헤더·굵기·목록·인용·코드 등 Claude 응답 전체 문법 정상 렌더링
- **매출 관리 페이지** (`frontend/app/dashboard/sales/page.tsx`)
  - "📊 파일로 가져오기" 버튼 추가 (CSV/Excel 업로드)
  - 컬럼 매핑 미리보기 + 행별 체크박스 선택 후 일괄 등록
- **마케팅 페이지** (`frontend/app/dashboard/marketing/page.tsx`)
  - 강조 메뉴 입력 → `/menus/` API 드롭다운으로 교체 (메뉴 없으면 텍스트 input 폴백)
- **사이드바** (`frontend/app/dashboard/layout.tsx`)
  - 하드코딩된 카페명·상권 → `boss_profile` localStorage에서 실제 데이터로 교체

---

## [v0.10.1] — 2026-04-15

### 기능 — 마케팅 AI 콘텐츠 생성

#### Added

- **마케팅 콘텐츠 API** (`backend/api/routers/marketing.py`)
  - `POST /marketing/generate` — Claude API 기반 SNS 콘텐츠 초안 생성
  - 콘텐츠 타입 4종: `instagram` / `blog` / `event` / `menu_highlight`
  - 매출·인기메뉴·계절·공휴일·상권 컨텍스트 자동 반영
  - 타입별 포맷 지정 (인스타 캡션+해시태그, 블로그 제목+본문 등)
- **마케팅 콘텐츠 페이지** (`frontend/app/dashboard/marketing/page.tsx`)
  - 콘텐츠 종류 선택 카드 (2×2 그리드)
  - 강조 메뉴·특별 내용 입력
  - 결과 표시 + 복사하기 + 다시 생성 버튼

#### Changed

- **메인 API** (`backend/api/main.py`) — `/marketing` 라우터 등록
- **사이드바** (`frontend/app/dashboard/layout.tsx`) — 마케팅 메뉴 추가

---

## [v0.10.0] — 2026-04-15

### 기능 — 비용 관리 + 순수익 계산 + AI 인사이트 비용 컨텍스트

#### Added

- **비용 관리 API** (`backend/api/routers/expenses.py`)
  - `POST /expenses/` — 비용 입력 (월세·재료비·인건비·공과금·기타)
  - `GET /expenses/` — 비용 목록 조회 (날짜 범위 필터)
  - `GET /expenses/summary` — 월별 비용 요약 + 카테고리별 분해
  - `PUT /expenses/{id}` / `DELETE /expenses/{id}` — 수정·삭제
  - `get_expense_summary()` 공용 함수 — insights API에서 재사용
- **비용 Pydantic 스키마** (`backend/api/schemas/expense.py`)
  - `ExpenseCreate` / `ExpenseResponse` / `ExpenseUpdate`
  - `ExpenseCategory` Literal 타입 (`rent | ingredient | labor | utility | other`)
- **expenses 테이블** (`backend/db/migrations/015_expenses.sql`)
  - RLS 4정책 (SELECT · INSERT · UPDATE · DELETE) + `user_id, date` 복합 인덱스
  - Supabase 마이그레이션 적용 완료
- **비용 관리 페이지** (`frontend/app/dashboard/expenses/page.tsx`)
  - 카테고리별 아이콘 버튼 선택 UI (🏠 월세 / 🧃 재료비 / 👤 인건비 / 💡 공과금 / 📦 기타)
  - 카테고리별 합계 카드 + 총 지출 카드
  - 수정·삭제 인라인 지원
- **신규 기능 구현 계획 문서** (`docs/feature-new-implementation-plan.md`)
  - Phase 1~3 / Step 1~9 의존성 기반 구현 로드맵

#### Changed

- **대시보드 메인** (`frontend/app/dashboard/page.tsx`)
  - 통계 카드 4종 교체: 거래건수·일평균 → **이번달 지출·순수익** 카드 추가
  - `ExpenseSummary` 타입 추가, `/expenses/summary` API 병렬 호출
- **AI 인사이트** (`backend/api/routers/insights.py`)
  - `/insights/analyze` 응답에 `net_profit` · `total_expenses` 필드 추가
  - 비용 데이터가 있을 때 Claude 프롬프트에 `[이번달 비용 현황]` 섹션 자동 주입
  - 응답에 순수익 컨텍스트 포함 → 매출만이 아닌 수익성 기반 분석 가능
- **사이드바 네비게이션** (`frontend/app/dashboard/layout.tsx`)
  - "매출 관리" 하위에 "비용 관리" (`/dashboard/expenses`) 메뉴 추가
- **메인 API 등록** (`backend/api/main.py`)
  - `expenses` 라우터 `/expenses` prefix로 등록

---

## [v0.9.1] — 2026-04-15

### 버그 수정 — 표준 근로계약서 PDF 오버레이 좌표 정밀화 + Supabase Storage 폴백

#### Fixed

- **근로계약서 "20" 보존 버그** (`backend/api/routers/pdf_forms.py`)
  - 근로계약기간 년도 흰 박스 시작 x `174→177`, 종료 년도 `323→327` — "20" 글자가 덮이던 문제 해결
- **기본급 위치 엉뚱한 행 삽입** (`backend/api/routers/pdf_forms.py`)
  - `get_text("words")` 분석으로 보수표 헤더행 정확 좌표 확인 — y `596→577`, x `357→280`
  - 가족수당 행(y=596)에 금액이 삽입되던 문제 해결
- **임금지급일 pre-print 원복** (`backend/api/routers/pdf_forms.py`)
  - "보수는 매월 25일" 서식 원문 흰 박스로 덮던 로직 제거 — 서식 그대로 보존
- **근로자\_동의 필드 제거** (`backend/api/routers/pdf_forms.py`, `frontend/app/drafts/[type]/page.tsx`)
  - 실제 서식에 없는 단독 체크박스 필드를 잘못 삽입하던 문제 해결 — 해당 필드 전체 삭제
- **수령확인 V 체크 위치** (`backend/api/routers/pdf_forms.py`)
  - □ 글리프 내부에 정확히 위치하도록 x `396→403` 조정

#### Added

- **Supabase Storage PDF 서빙** (`backend/api/routers/pdf_forms.py`)
  - `_fetch_pdf_bytes()` — Storage `startup-forms` 버킷 우선 다운로드 + 메모리 캐시
  - 다운로드 실패 시 로컬 `frontend/public/forms/` 폴백
- **근로계약서 서두 + 서명란 필드 분리** (`backend/api/routers/pdf_forms.py`)
  - `근로자_성명_서두`, `근로자_서명_성명`, `채용기관장_대표성명` 필드 추가 — 3곳에 각각 삽입
- **프로필 기반 상호명 자동 적용** (`frontend/app/drafts/[type]/page.tsx`)
  - `profileFromStorage().business_name` 우선 → localStorage 구버전 데이터("연남동") 덮어쓰기 방지
- **수령확인 체크박스 등록** (`frontend/app/drafts/[type]/page.tsx`)
  - `CHECKBOX_KEYS` Set에 `"수령확인"` 추가 — UI 체크박스로 올바르게 렌더링

---

## [v0.9.0] — 2026-04-15

### 기능 — 지원사업 신청서 초안 자동 작성 + 답변 저장

#### Added

- **HWP5 텍스트 파서** (`backend/rag/hwp_parser.py`)
  - olefile + zlib 기반 HWP5 파일 텍스트 추출 — `hwp5` 패키지 불필요
  - OLE 아카이브 → zlib raw deflate 압축 해제 → HWP 레코드 스트림 파싱
  - `HWPTAG_PARA_TEXT(67)` 레코드 추출, 2바이트 유니코드 디코딩
- **신청서 카드 에이전트** (`backend/agents/subsidy_draft.py`)
  - HWP 원문 + 창업자 프로파일 → Claude Haiku 단일 호출로 항목 구조화 + pre-fill
  - 카드 구조: `id / section / field_name / description / required / type / value`
  - 프로파일 필드 키워드 매핑 (`apply_profile_prefill`) — 매 요청마다 최신 프로파일 재적용
  - JSON 파싱 3단계 폴백 (전체 파싱 → 블록 추출 → 잘린 JSON 복구)
  - HWP 없는 공고: 공고 description 기반 폴백 카드 생성
- **신청서 초안 API** (`POST /subsidies/{program_id}/draft`)
  - BizInfo 상세 페이지 스크래핑 → HWP 다운로드 → 텍스트 추출 → 카드 생성
  - `subsidy_attachments.cards_json` 캐시 (최초 1회 Claude 호출 후 구조 재사용)
  - 캐시 사용 시 `apply_profile_prefill`로 현재 프로파일 value 재적용 (stale 방지)
  - `subsidy_draft_answers` 조회 후 저장 답변 머지 (우선순위: 저장값 > 프로파일 > Claude)
- **답변 저장 API** (`PUT /subsidies/{program_id}/draft/answers`)
  - 카드 입력값 `subsidy_draft_answers` 테이블에 upsert
- **카드 에디터 UI** (`frontend/app/drafts/subsidy/page.tsx`)
  - 2-pane 레이아웃: 좌측 섹션 목록 + 우측 입력 에디터
  - 1.5초 debounce 자동 저장 — 헤더에 "저장 중… / 저장됨 / 저장 실패" 표시
  - 커스텀 항목 추가/삭제, text·textarea·date·number 타입 지원
  - 페이지 재진입 시 저장 답변 자동 복원
- **첨부파일 일괄 수집** (`backend/data/sync/attachment_sync.py`, `backend/scripts/fetch_subsidy_attachments.py`)
  - 일 1회(06:30 KST) 스케줄러로 HWP 수집 및 텍스트 추출 캐싱
- **DB 마이그레이션**
  - `015_subsidy_attachments.sql` — `subsidy_attachments` 테이블 (HWP 메타데이터·원문 캐시)
  - `016_subsidy_draft_answers.sql` — `subsidy_attachments.cards_json` 컬럼 추가 + `subsidy_draft_answers` 테이블

---

## [v0.8.1] — 2026-04-14

### 버그 수정 — RAG 검색 안정성 + 인사이트 데이터 품질 개선

#### Fixed

- **임베딩 직렬화 정밀도 개선** (`backend/rag/retriever/pgvector_retriever.py`)
  - `str(v)` → `f"{v:.10f}"` — float 소수점 표현 불일치로 유사도 오차 발생하던 문제 해결
  - `retrieve`, `retrieve_mapo_stats`, `retrieve_docs`, `hybrid_retrieve` 4개 함수 전체 적용
- **BGE-M3 멀티스레드 경합 해소** (`backend/rag/embeddings/bge_embeddings.py`)
  - `threading.Lock()` 추가 — `SentenceTransformer` 동시 호출 시 세그폴트/결과 오염 방지
  - `_encode_sync` 전체를 Lock 컨텍스트 내로 이동
- **RAG 중복 제거 로직 버그 수정** (`backend/api/routers/insights.py`)
  - 단일 `seen_ids`로 전체 카테고리 중복을 제거하던 문제 → 카테고리별 독립 seen 집합으로 분리
  - 상이한 카테고리의 동일 ID 문서가 누락되지 않도록 수정
- **RAG 검색 임계값 완화** (`backend/api/routers/insights.py`)
  - `_search` 함수 기본 threshold `0.4` → `0.25`로 낮춤 — 유동인구·상권·전략 문서 검색 누락 감소
  - 각 카테고리 별도 threshold 설정: population/commercial `0.25`, strategy `0.25`

#### Changed

- **RAG 검색 디버그 로그 추가** (`backend/api/routers/insights.py`)
  - 카테고리별 검색 쿼리·반환 건수·주입 청크 내용(120자) 콘솔 출력
- **FullCalendar 패키지 업그레이드** (`frontend/package.json`)
  - `@fullcalendar/*` `6.1.15` → `6.1.20` (daygrid, interaction, list, react)

---

## [v0.8.0] — 2026-04-14

### 기능 개선 — 서류 초안 PDF 오버레이 UX 전면 고도화

#### Added

- **식품영업신고서 레이아웃 보정** (`backend/api/routers/pdf_forms.py`)
  - PyMuPDF `add_redact_annot` + `apply_redactions`로 하단 '210mm×297mm 백상지' 문구 영구 삭제
  - 신고인 성명/주소 row 각 +5pt 확장 — 기존 y=132.9~169.0 → y=132.9~174.0 (셀 경계선 직접 재작성)
  - 흰 박스 덮기 → 내부 구분선(회색 0.36pt) + 외곽선(검정 0.84pt) 재그리기로 깔끔한 서식 유지
- **사업자등록·식품영업 체크박스 통합 토글 UI** (`frontend/app/drafts/[type]/page.tsx`)
  - `CHECKBOX_KEYS` Set — 사업자등록(25개) + 식품영업(29개) 체크박스 필드 통합 관리
  - `CHECKBOX_SECTIONS` 그룹 설정 — 사업자등록 12개 그룹 / 식품영업 6개 그룹으로 편집 패널 하단 배치
  - 토글 버튼: `[V]` = 체크 (파란 배경) / `[ ]` = 미체크 (흰 배경) — PDF 렌더링과 동일한 표시
  - `HIDDEN_EDIT_FIELDS` — 구 방식 단일 키(여/부) 편집 패널에서 제외 + `applyFixedValues` 마이그레이션
- **체크박스 값 정규화** (`applyFixedValues`)
  - 구 방식("여"/"부"/"해당"/"미해당") → 신 방식("V"/"") 일괄 변환 (localStorage·DB 저장 데이터 하위호환)
  - 사업자등록 구 단일 키(자동정정신청, 투자조합*출자여부 등 8종) → `*여`/`\_부` 쌍으로 자동 마이그레이션
- **CORS 500 오류 대응** (`backend/api/main.py`)
  - FastAPI CORSMiddleware 500 헤더 누락 → 글로벌 `@app.exception_handler(Exception)` 추가
- **load-fields 500 수정** (`backend/api/routers/pdf_forms.py`)
  - `.maybe_single()` → `.order("id", desc=True).limit(1)` 교체 — 복수 행 시 APIError 방지

#### Changed

- **명칭(상호) 상태 갱신** — food-biz/employment-contract 로드 시 사업자등록 DB `상호_단체명` 항상 재조회
  - localStorage 캐시가 stale해도 최신 상호명으로 자동 갱신

#### Fixed

- **신고인 성명 빈칸 버그** (`frontend/app/drafts/[type]/page.tsx`)
  - 백엔드 500 시 background refresh가 이름 주입 없이 `setEditedFields` 덮어쓰던 문제
  - DB `성명_대표자` → `profileFromStorage().name` → auth `userName` 순으로 확정, fetch 전 선주입
  - mock "홍길동" → 로그인 auth 이름으로 무조건 교체
- **load-fields 500 에러** (`backend/api/routers/pdf_forms.py`)
  - `.maybe_single()` → `.order("id", desc=True).limit(1)` 교체 — 복수 행 시 PostgREST APIError 방지
- **CORS 500 헤더 누락** (`backend/api/main.py`)
  - 미처리 예외 응답에 CORS 헤더 포함되도록 글로벌 exception handler 추가
- **사업자등록 편집 패널 구 방식 키 노출** (`frontend/app/drafts/[type]/page.tsx`)
  - "자동정정신청"·"투자조합\_출자여부" 등 구 단일 키 10종이 텍스트 입력으로 노출되던 문제
  - `HIDDEN_EDIT_FIELDS` 추가 + `applyFixedValues` 마이그레이션으로 신 방식 `_여`/`_부` 쌍으로 자동 변환

---

## [v0.7.0] — 2026-04-14

### 기능 개선 — 인사이트 데이터 풀 연결 + 상권 벤치마킹 (Steps 1–7)

#### Added

- **마포구 유동인구 RAG 연결** (`backend/rag/retriever/pgvector_retriever.py`)
  - 기존 mapo_stats 전용 검색에서 4-way 병렬 검색으로 확장
  - `retrieve_docs()` 범용 함수 추가 — `match_docs` RPC(migration 013) 사용
  - 유동인구(5,824청크) · 상권변화지표 · 전략 가이드 동시 RAG 검색
  - `retrieve_strategy()` 버그 수정 — `law_chunks` → `documents` 테이블로 교정
- **Claude 프롬프트 4개 섹션 자동 주입** (`backend/api/routers/insights.py`)
  - `[마포구 카페 상권 통계]` · `[마포구 유동인구]` · `[마포구 상권변화지표]` · `[소상공인 경영 전략 가이드]`
  - `[날씨 정보]` — 비·맑음 일별 매출 상관 분석 (weather_data 테이블 직접 조회)
  - `[공휴일 정보]` — 해당 월 공휴일 목록 자동 주입 (holidays.json 기반)
  - 시스템 프롬프트 확장 — 유동인구 피크 시간대 · 상권등급(HH/HL/LH/LL) 인용 가이드 추가
- **상권 평균 벤치마킹** (`GET /insights/areas`, `GET /insights/benchmark`)
  - 32개 마포구 상권 드롭다운 선택 → 내 카페 월 매출 vs 상권 카페 1개당 평균 비교
  - 수평 바 차트 시각화 — 평균 대비 비율(%) + 초과/미달 금액 표시
  - AI 분석과 독립적으로 동작 (매출 데이터 없어도 상권 평균 조회 가능)
  - 요청 분기 데이터 없으면 최신 분기(20244)로 자동 폴백
- **DB 마이그레이션** (`migrations/013_match_documents_by_category.sql`)
  - `match_docs()` RPC — documents 테이블 카테고리별 범용 벡터 검색 함수
- **구현 문서** (`docs/steps-1-7-implementation.md`) — 데이터 흐름·API·테스트 방법 정리

#### Changed

- 인사이트 페이지 벤치마킹 섹션 항상 표시 (기존: AI 분석 후에만 표시)
- 날씨 반영 배지 (`날씨 반영`) AI 분석 결과 헤더에 추가

---

## [v0.6.0] — 2026-04-14

### 기능 — 지원사업 공고 캘린더 + 전용 하이브리드 검색

#### Added

- **지원사업 공고 캘린더** (`frontend/app/dashboard/subsidies/page.tsx`)
  - FullCalendar 기반 구글 캘린더 스타일 월간 뷰 (데스크탑) + `listMonth` 뷰 (모바일 자동 전환)
  - 누적형 지역 필터 버튼 그룹: `숨김 → 마포구 → + 서울 → + 전국`
  - 기간 파싱 가능한 공고는 캘린더 bar, 불가 공고("예산 소진시까지" 등)는 **상시 모집 섹션** 분리
  - 공고 클릭 시 사이드 드로어 — 접수 기간·지원 대상·분야·설명·기업마당 원문/주관기관 홈페이지 링크
  - 이벤트 bar 얇게 스타일 튜닝 (11px · line-height 1.25 · 여백 축소)
- **기업마당 API 통합 정상화** (`backend/data/crawlers/bizinfo.py`)
  - 기존 코드가 잘못된 파라미터(`authKey`/`items`)를 사용해 미동작 상태였던 문제 수정 — `crtfcKey`/`jsonArray` 로 교체
  - 기간 필드 `reqstBeginEndDe` 단일 문자열 파싱 (YYYY-MM-DD / YYYY.MM.DD) 및 상시 모집 자동 분류
  - HTML 태그가 섞인 `bsnsSumryCn` 설명 본문 정리
  - `pldirSportRealmLclasCodeNm == '창업'` 대분류 필터로 범위 좁힘 (약 90여 건)
- **DB 스키마** (`migrations/013_subsidy_programs.sql`, `014_subsidy_programs_search.sql`)
  - `subsidy_programs` 테이블 — `external_id UNIQUE` 중복 방지, `is_ongoing`·`period_raw`·`program_kind`·`sub_kind` 등 확장 컬럼
  - `subsidy_fetch_log(fetch_date PK)` — 하루 1회 동기화 멱등성 확보 (동시 호출 경합은 PK 선점 insert 로 방지)
  - `subsidy_programs.embedding vector(1024)` + HNSW 인덱스 + `pg_trgm` GIN 인덱스
  - `search_subsidies()` RPC — 벡터 + FTS + trigram 3-way RRF 하이브리드 검색
- **지원사업 전용 임베딩 파이프라인** (`backend/rag/subsidy_ingest.py`)
  - 제목 + 분야 + 대상 + 지역 + 주관 + 기간 + 태그 + 내용을 구조화해 한 번의 BGE-M3 임베딩
  - 법령 RAG(`law_chunks`) 와 독립된 자체 테이블에 저장 — 카테고리 오염 방지
  - `embedded_at` 타임스탬프로 증분 재임베딩 지원
- **API 엔드포인트** (`backend/api/routers/subsidies.py`)
  - `GET /subsidies/calendar?from=&to=` — 기간 내 공고
  - `GET /subsidies/ongoing` — 상시 모집 공고
  - `POST /subsidies/search` — 공고 전용 하이브리드 검색
  - `POST /subsidies/sync-today` — 일일 증분 동기화
- **CLI 스크립트**
  - `backend/scripts/backfill_subsidies.py` — 스냅샷 1회 수집
  - `backend/scripts/ingest_subsidies.py` — 임베딩 (`--incremental` 옵션)

#### Changed

- 사이드바: "AI 인사이트" 와 "알림" 사이에 **지원사업** 메뉴 추가 (`frontend/app/dashboard/layout.tsx`)
- 법령 RAG 드롭다운에서 "지원사업 공고" 제거 — 전용 페이지로 분리
- 프론트 의존성: `@fullcalendar/react`, `daygrid`, `list`, `interaction`, `core` 6종 추가

#### Fixed

- 기존 bizinfo 크롤러가 런타임에 실패하던 문제 (API 응답 구조 변경 반영)

---

## [v0.5.0] — 2026-04-14

### 기능 개선 — RAG 하이브리드 검색 정확도 강화 + 인사이트 데이터 확장 + 서류 자동화 고도화

#### Added

- **3-way RRF 하이브리드 검색** (`migrations/012_hybrid_search_trigram.sql`)
  - `pg_trgm` 기반 trigram 랭커를 3번째 RRF 성분으로 추가 — PostgreSQL `simple` 토크나이저의 한국어 복합어 분리 한계 보완
  - `word_similarity(query, content)`로 `"최저임금"` ↔ `"최저임금법"` 같은 부분 매칭 지원
  - `char_length(content) > 40` 필터 — "제24조(정부의 지원)" 같은 제목만 있는 article 청크 제외
  - `gin_trgm_ops` GIN 인덱스 (`law_chunks_content_trgm_idx`)
- **RAG 법령 브리프 마크다운 렌더링** — `ReactMarkdown` + `remark-gfm` + `@tailwindcss/typography` 적용, Claude 응답의 헤딩·리스트·인용·표 가독성 확보 (`frontend/components/rag/LlmSummaryPanel.tsx`)
- **PDF 서식 좌표 오버레이 라우터** (`backend/api/routers/pdf_forms.py`) — PyMuPDF 기반 정부 표준서식 4종(사업자등록신청서·식품영업신고서·표준근로계약서·상가임대차계약서) 좌표 오버레이 API
- **인사이트 데이터 소스 확장 (PR #18)**
  - `backend/data/crawlers/holiday_crawler.py` — 공휴일 데이터 (`holidays.json` 시드)
  - `backend/data/crawlers/weather_crawler.py` + `migrations/010_weather.sql` — 기상청 데이터
  - `backend/data/crawlers/mapo_population_crawler.py` — 마포구 상권별 유동인구
  - `backend/data/parsers/commercial_change_parser.py` — 마포구 개폐업 통계 CSV 파서
  - `backend/scripts/` — `ingest_laws.py`, `seed_holidays.py`, `seed_weather.py`, `seed_mapo_population.py`, `seed_commercial_change.py`, `seed_strategy.py`
  - `backend/core/holidays.py` — 공휴일 판정 유틸
- **Google Gemini 에이전트 통합** — `backend/agents/gemini.py`
- **feature-9-10 분석 문서** — `docs/feature-9-10-analysis.md`

#### Changed

- **하이브리드 검색 응답 스키마 분리** (`migrations/011_hybrid_search_cosine_similarity.sql`)
  - 기존 `score` 컬럼은 RRF 내부 정렬 점수(최댓값 ≈ 0.033) — 프론트에서 `× 100`으로 오역되어 "3%"처럼 표시되는 문제 해결
  - `similarity` 컬럼(실제 코사인 유사도 %) 분리 반환 → UI는 사용자 지표로 `similarity`를, 정렬은 `score`를 사용
- `backend/api/routers/rag.py` — 응답 매핑을 `similarity` 기준으로 변경
- `frontend/app/dashboard/rag/page.tsx` — 유사도 배지 표시 로직 개편, 카테고리 필터 UX 개선
- `frontend/app/drafts/[type]/page.tsx` — PDF 좌표 입력 UI 확장 (67라인 → 471라인), 필드 입력·실시간 오버레이·PDF 다운로드
- `frontend/tailwind.config.ts` — `@tailwindcss/typography` 플러그인 활성화
- `backend/core/constants.py` — 카테고리 상수 정리 (PR #18)

#### Fixed

- RAG 검색 결과 유사도 수치가 내부 RRF 점수로 표시되던 오류
- 벡터 단독 랭킹에서 제목만 있는 짧은 조문 청크가 상위로 노출되던 오염
- `weather_crawler` 기상청 API 403 오류 해소 — serviceKey URL 직접 삽입 → params dict 방식 변경
- 인사이트 API 공휴일 컨텍스트 누락 — `get_month_holidays()` 추가로 Claude 프롬프트에 해당 월 공휴일 자동 주입
- `seed_strategy` SEMAS 상권분석과 창업 시리즈 5개 PDF 추가 (`docs/strategy/`, 2020~2021년)

---

## [v0.4.3] — 2026 Q1

### 법령 검색 카테고리 필터 버그 수정

- `hybrid_search` RPC 파라미터 타입 `vector` → `text` 캐스팅 (`008_fix_vector_text_param.sql`) — PostgREST `list[float]` 직렬화 실패 대응
- ivfflat → **HNSW** 인덱스 교체 (`009_fix_ivfflat_index.sql`) — `lists=100, probes=1`의 cluster miss 문제 해결
- 인허가 법령 `LICENSE` / `REGULATION` 카테고리 분리 — 식품위생법·소방법·건축법은 LICENSE, 개인정보보호법은 REGULATION

---

## [v0.4.2]

- 서류 초안 폼 UI — PDF 오버레이 방식 4종 (사업자등록신청서·식품영업신고서·표준근로계약서·상가임대차계약서)
- 프로필 페이지 `/dashboard/profile`
- 온보딩 UX 개선, html2pdf 클라이언트 사이드 출력

---

## [v0.4.1]

- 창업자 상태머신 활성화 — `GET /founders/me/state`
- 상태 전이 트리거 연결, 오케스트레이터 DB 로드
- 사이드바 현재 단계 표시, 온보딩 필수 항목 최소화

---

## [v0.4.0]

- 부가가치세 신고서 국세청 공식 서식 PDF (PyMuPDF 좌표 오버레이)
- 매출 인사이트 강화, 법령 계층적 청킹
- DB 마이그레이션 004·005

---

## [v0.3.2]

- RAG API 라우터 추가 (`/rag/ingest`, `/rag/search`, `/rag/summarize`, `/rag/stats`)
- 세금 초안 PDF 다운로드 (ReportLab 한글 CID 폰트)

---

## [v0.3.1]

- 입지분석 9개 상권 확대
- 서울 열린데이터 API 전환
- 검색 이력 UI, 비인증 분석 허용

---

## [v0.3.0]

- 창업자 온보딩 위저드 (4단계)
- 입지분석 UI (레이더 차트·LLM 리포트)
- 매출 입력 페이지
- Supabase Auth 연동 완성

---

## [v0.2.0]

- 규제법령 RAG (법제처 + BGE-M3)
- 입지분석 시뮬레이션
- 세금 스케줄링, 채용 자동화
- Sales API

---

## [v0.1.0]

- 백엔드 초기 구조
- 메인 페이지, 대시보드, 로그인/회원가입
