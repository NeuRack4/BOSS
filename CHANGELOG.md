# Changelog

BOSS 버전 이력입니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 규약을 따르며, 버전 번호는 [SemVer](https://semver.org) 형식입니다.

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
