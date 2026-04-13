"""
서울 열린데이터광장 골목상권 분석 API 크롤러

사용 API:
- OA-15572: 추정매출-상권 (서비스명: VwsmTrdarSelngQq)
- OA-15577: 점포-상권    (서비스명: VwsmTrdarStorQq)
- OA-15576: 상권변화지표  (서비스명: VwsmTrdarlxQq) — 현재 서버 500 오류

엔드포인트 형식:
  http://openapi.seoul.go.kr:8088/{KEY}/json/{SERVICE}/{START}/{END}/{STDR_YYQU_CD}

분기 코드 형식: YYYYQ (예: 20244 = 2024년 4분기)

실제 응답 필드 (2023년 기준):
  VwsmTrdarSelngQq: TRDAR_CD_NM, SVC_INDUTY_CD_NM, THSMON_SELNG_AMT, THSMON_SELNG_CO,
                    MON_SELNG_AMT, TUES_SELNG_AMT, WED_SELNG_AMT, THUR_SELNG_AMT,
                    FRI_SELNG_AMT, SAT_SELNG_AMT, SUN_SELNG_AMT,
                    TMZON_00_06_SELNG_AMT ... TMZON_21_24_SELNG_AMT
  VwsmTrdarStorQq:  TRDAR_CD_NM, SVC_INDUTY_CD_NM, STOR_CO, OPBIZ_RT, CLSBIZ_RT,
                    SIMILR_INDUTY_STOR_CO, FRC_STOR_CO

  ※ SIGNGU_CD_NM 필드 없음 — TRDAR_CD_NM의 마포구 상권명 키워드로 필터

.env 설정:
  SEOUL_OPEN_API_KEY=발급받은_인증키

이용약관: 공공누리 1유형 (출처표시 시 자유 이용)
"""
import httpx
from backend.core.config import get_settings

_BASE_URL = "http://openapi.seoul.go.kr:8088"
_PAGE_SIZE = 1000

# 마포구 9개 상권 키워드 (TRDAR_CD_NM 포함 여부로 판단)
# CLAUDE.md 기준: 홍대입구·합정·연남동·망원동·공덕·성산동·마포대로·아현동·신수동
_MAPO_KEYWORDS = ["홍대", "합정", "연남", "망원", "공덕", "성산", "마포", "아현", "신수"]

# 카페/커피 업종 키워드 (SVC_INDUTY_CD_NM 포함 여부로 판단)
_CAFE_KEYWORDS = ["커피", "카페", "다방"]


def _api_key() -> str:
    key = get_settings().seoul_open_api_key
    if not key:
        raise ValueError(
            "SEOUL_OPEN_API_KEY가 .env에 설정되지 않았습니다.\n"
            "SEOUL_OPEN_API_KEY=발급받은_인증키 형식으로 추가해주세요."
        )
    return key


def _build_url(service: str, start: int, end: int, quarter: str) -> str:
    return f"{_BASE_URL}/{_api_key()}/json/{service}/{start}/{end}/{quarter}"


async def _fetch_all(service: str, quarter: str, *, debug: bool = False) -> list[dict]:
    """페이징 처리하여 서비스 전체 데이터 수집"""
    all_rows: list[dict] = []
    start = 1

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            end = start + _PAGE_SIZE - 1
            url = _build_url(service, start, end, quarter)

            if debug:
                masked = url.replace(_api_key(), "***KEY***")
                print(f"[seoul_alley][DEBUG] GET {masked}")

            try:
                resp = await client.get(url)
                resp.raise_for_status()
            except httpx.HTTPError as e:
                print(f"[seoul_alley] HTTP 오류 (service={service}): {e}")
                break

            body = resp.json()

            if debug and not all_rows:
                print(f"[seoul_alley][DEBUG] 응답 최상위 키: {list(body.keys())}")

            service_data = body.get(service, {})

            if not service_data:
                print(f"[seoul_alley] 응답에 '{service}' 키 없음. 실제 키: {list(body.keys())}")
                break

            # API 오류 코드 확인
            result = service_data.get("RESULT", {})
            code = result.get("CODE", "INFO-000")
            if code != "INFO-000":
                print(f"[seoul_alley] API 오류 [{code}]: {result.get('MESSAGE')}")
                break

            rows = service_data.get("row", [])

            if debug and rows and not all_rows:
                # extend 전에 체크 — 첫 페이지 첫 행의 모든 키 출력
                print(f"[seoul_alley][DEBUG] {service} 첫 행 필드명: {list(rows[0].keys())}")
                print(f"[seoul_alley][DEBUG] {service} 첫 행 샘플: { {k: v for k, v in list(rows[0].items())[:8]} }")

            all_rows.extend(rows)

            if len(rows) < _PAGE_SIZE:
                break
            start += _PAGE_SIZE

    if debug:
        print(f"[seoul_alley][DEBUG] {service} 총 {len(all_rows)}행 수집 (필터링 전)")
    return all_rows


def _is_mapo(row: dict) -> bool:
    """TRDAR_CD_NM(상권명)에 마포구 지명 키워드가 포함되면 마포구 상권으로 판단"""
    name = row.get("TRDAR_CD_NM", "")
    return any(kw in name for kw in _MAPO_KEYWORDS)


def _is_cafe(row: dict) -> bool:
    """SVC_INDUTY_CD_NM(업종명)에 카페 키워드가 포함되면 카페로 판단"""
    name = row.get("SVC_INDUTY_CD_NM", "")
    return any(kw in name for kw in _CAFE_KEYWORDS)


async def fetch_mapo_cafe_sales(quarter: str, *, debug: bool = False) -> list[dict]:
    """
    OA-15572 추정매출 데이터 — 마포구 카페 필터링

    실제 반환 필드:
      TRDAR_CD_NM, SVC_INDUTY_CD_NM,
      THSMON_SELNG_AMT (월 매출금액), THSMON_SELNG_CO (월 매출건수),
      MON/TUES/WED/THUR/FRI/SAT/SUN_SELNG_AMT,
      TMZON_00_06 ~ TMZON_21_24_SELNG_AMT
    """
    rows = await _fetch_all("VwsmTrdarSelngQq", quarter, debug=debug)
    result = [r for r in rows if _is_mapo(r) and _is_cafe(r)]
    print(f"[seoul_alley] 추정매출 수집: {len(result)}건 (마포구 카페) / 전체 {len(rows)}건")
    return result


async def fetch_mapo_cafe_stores(quarter: str, *, debug: bool = False) -> list[dict]:
    """
    OA-15577 점포·폐업률 데이터 — 마포구 카페 필터링

    실제 반환 필드:
      TRDAR_CD_NM, SVC_INDUTY_CD_NM,
      STOR_CO (점포수), OPBIZ_RT (개업률), CLSBIZ_RT (폐업률),
      SIMILR_INDUTY_STOR_CO (유사업종 점포수), FRC_STOR_CO (프랜차이즈 점포수)
    """
    rows = await _fetch_all("VwsmTrdarStorQq", quarter, debug=debug)
    result = [r for r in rows if _is_mapo(r) and _is_cafe(r)]
    print(f"[seoul_alley] 점포현황 수집: {len(result)}건 (마포구 카페) / 전체 {len(rows)}건")
    return result


async def fetch_mapo_change_index(quarter: str, *, debug: bool = False) -> list[dict]:
    """
    OA-15576 상권변화지표 데이터 — 마포구 필터링

    ※ 현재 서버 500 오류 상태. 빈 리스트 반환 (seed는 매출/점포 데이터만으로 진행).
    """
    rows = await _fetch_all("VwsmTrdarlxQq", quarter, debug=debug)
    result = [r for r in rows if _is_mapo(r)]
    print(f"[seoul_alley] 상권변화지표 수집: {len(result)}건 (마포구) / 전체 {len(rows)}건")
    return result
