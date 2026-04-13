"""
서울 열린데이터광장 골목상권 분석 API 크롤러

사용 API:
- OA-15572: 추정매출-상권 (서비스명: VwsmTrdarSelngQq)
- OA-15577: 점포-상권    (서비스명: VwsmTrdarStorQq)
- OA-15576: 상권변화지표  (서비스명: VwsmTrdarlxQq)

엔드포인트 형식:
  http://openapi.seoul.go.kr:8088/{KEY}/json/{SERVICE}/{START}/{END}/{STDR_YYQU_CD}

분기 코드 형식: YYYYQ (예: 20244 = 2024년 4분기)

.env 설정:
  SEOUL_OPEN_API_KEY=발급받은_인증키

이용약관: 공공누리 1유형 (출처표시 시 자유 이용)
"""
import httpx
from backend.core.config import get_settings

_BASE_URL = "http://openapi.seoul.go.kr:8088"
_PAGE_SIZE = 1000

# 마포구 필터
_MAPO = "마포구"

# 카페/커피 업종 키워드 (업종명 포함 여부로 판단)
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


async def _fetch_all(service: str, quarter: str) -> list[dict]:
    """페이징 처리하여 서비스 전체 데이터 수집"""
    all_rows: list[dict] = []
    start = 1

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            end = start + _PAGE_SIZE - 1
            url = _build_url(service, start, end, quarter)

            try:
                resp = await client.get(url)
                resp.raise_for_status()
            except httpx.HTTPError as e:
                print(f"[seoul_alley] HTTP 오류 (service={service}): {e}")
                break

            body = resp.json()
            service_data = body.get(service, {})

            # API 오류 코드 확인
            result = service_data.get("RESULT", {})
            if result.get("CODE", "INFO-000") != "INFO-000":
                print(f"[seoul_alley] API 오류: {result.get('MESSAGE')}")
                break

            rows = service_data.get("row", [])
            all_rows.extend(rows)

            if len(rows) < _PAGE_SIZE:
                break
            start += _PAGE_SIZE

    return all_rows


def _is_mapo(row: dict) -> bool:
    return row.get("SIGNGU_CD_NM", "") == _MAPO


def _is_cafe(row: dict) -> bool:
    for field in ["INDUTY_SMALL_CL_CD_NM", "INDUTY_MIDDLE_CL_CD_NM", "INDUTY_LARGE_CL_CD_NM"]:
        name = row.get(field, "")
        if any(kw in name for kw in _CAFE_KEYWORDS):
            return True
    return False


async def fetch_mapo_cafe_sales(quarter: str) -> list[dict]:
    """
    OA-15572 추정매출 데이터 — 마포구 카페 필터링

    반환 필드 예시:
      TRDAR_CD_NM, SIGNGU_CD_NM, INDUTY_SMALL_CL_CD_NM,
      SELNG_AMT (분기 매출금액), SELNG_CO (분기 매출건수)
    """
    rows = await _fetch_all("VwsmTrdarSelngQq", quarter)
    result = [r for r in rows if _is_mapo(r) and _is_cafe(r)]
    print(f"[seoul_alley] 추정매출 수집: {len(result)}건 (마포구 카페)")
    return result


async def fetch_mapo_cafe_stores(quarter: str) -> list[dict]:
    """
    OA-15577 점포·폐업률 데이터 — 마포구 카페 필터링

    반환 필드 예시:
      TRDAR_CD_NM, SIGNGU_CD_NM, INDUTY_SMALL_CL_CD_NM,
      STOR_CO (점포수), OPBIZ_RT (개업률), CLSBIZ_RT (폐업률)
    """
    rows = await _fetch_all("VwsmTrdarStorQq", quarter)
    result = [r for r in rows if _is_mapo(r) and _is_cafe(r)]
    print(f"[seoul_alley] 점포현황 수집: {len(result)}건 (마포구 카페)")
    return result


async def fetch_mapo_change_index(quarter: str) -> list[dict]:
    """
    OA-15576 상권변화지표 데이터 — 마포구 필터링

    반환 필드 예시:
      TRDAR_CD_NM, SIGNGU_CD_NM,
      TRDAR_XCNTU_CD (HH/HL/LH/LL), TRDAR_XCNTU_CD_NM (지표명)
    """
    rows = await _fetch_all("VwsmTrdarlxQq", quarter)
    result = [r for r in rows if _is_mapo(r)]
    print(f"[seoul_alley] 상권변화지표 수집: {len(result)}건 (마포구)")
    return result
