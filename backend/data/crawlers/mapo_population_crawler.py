"""
서울 열린데이터광장 골목상권 행정동 유동인구 크롤러

사용 API:
- 서비스명: VwsmAdstrdFlpopW (골목상권 분석 행정동 단위 유동인구)
- 엔드포인트: http://openapi.seoul.go.kr:8088/{KEY}/json/VwsmAdstrdFlpopW/{START}/{END}/{STDR_YYQU_CD}

주요 반환 필드 (실제 API 기준):
  ADSTRD_CD        : 행정동 코드
  ADSTRD_CD_NM     : 행정동 명
  STDR_YYQU_CD     : 기준 연 분기 코드
  TOT_FLPOP_CO     : 총 유동인구 수
  ML_FLPOP_CO      : 남성 유동인구 수
  FML_FLPOP_CO     : 여성 유동인구 수
  AGRDE_10_FLPOP_CO ~ AGRDE_60_ABOVE_FLPOP_CO : 연령대별 유동인구
  MON_FLPOP_CO ~ SUN_FLPOP_CO                 : 요일별 유동인구
  TMZON_00_06_FLPOP_CO ~ TMZON_21_24_FLPOP_CO : 시간대별 유동인구 (6 구간)

.env 설정:
  SEOUL_OPEN_API_KEY=발급받은_인증키

이용약관: 공공누리 1유형 (출처표시 시 자유 이용)
robots.txt: openapi.seoul.go.kr — 크롤 제한 없음 (공공 API)

행정동 코드 매핑: constants.py 의 MAPO_ADSTRD_CODE_MAP 참조
마포구 행정동 코드 앞 5자리: 11440  (서울=11, 마포구=440)
"""
import httpx
from backend.core.config import get_settings
from backend.core.constants import MAPO_ADSTRD_CODE_MAP

# ── 상수 ─────────────────────────────────────────────────────────────────────

_BASE_URL = "http://openapi.seoul.go.kr:8088"
_SERVICE  = "VwsmAdstrdFlpopW"
_PAGE_SIZE = 1000

# 마포구 행정동 코드 앞 5자리 — 이 접두사로 마포구 행 필터링
_MAPO_GU_CODE_PREFIX = "11440"

# 행정동 이름 키워드 → 상권명 매핑
_DONG_TO_AREA: dict[str, str] = {
    "서교":  "홍대입구",
    "합정":  "합정",
    "연남":  "연남동",
    "망원":  "망원동",
    "공덕":  "공덕",
    "도화":  "공덕",
    "대흥":  "공덕",
    "성산":  "성산동",
    "마포":  "마포대로",
    "염리":  "마포대로",
    "아현":  "아현동",
    "신수":  "신수동",
}


# ── 내부 유틸 ────────────────────────────────────────────────────────────────

def _api_key() -> str:
    key = get_settings().seoul_open_api_key
    if not key:
        raise ValueError(
            "SEOUL_OPEN_API_KEY가 .env에 설정되지 않았습니다.\n"
            "SEOUL_OPEN_API_KEY=발급받은_인증키 형식으로 추가해주세요."
        )
    return key


def _build_url(start: int, end: int, quarter: str) -> str:
    return f"{_BASE_URL}/{_api_key()}/json/{_SERVICE}/{start}/{end}/{quarter}"


def _is_mapo(row: dict) -> bool:
    """ADSTRD_CD(행정동 코드)가 마포구 접두사로 시작하면 마포구 행정동으로 판단"""
    code = str(row.get("ADSTRD_CD", ""))
    return code.startswith(_MAPO_GU_CODE_PREFIX)


def resolve_area(dong_nm: str) -> str:
    """
    행정동 명에서 키워드 매칭으로 9개 상권 중 하나를 반환.
    매칭 없으면 행정동 명 그대로 반환.
    """
    for keyword, area in _DONG_TO_AREA.items():
        if keyword in dong_nm:
            return area
    return dong_nm


# ── 공개 API ─────────────────────────────────────────────────────────────────

async def fetch_mapo_population(quarter: str, *, debug: bool = False) -> list[dict]:
    """
    VwsmAdstrdFlpopW — 골목상권 행정동 단위 유동인구
    마포구 행정동(ADSTRD_CD 앞 5자리 = 11440)만 필터링하여 반환.

    각 row에 'resolved_area' 키(상권명)를 추가하여 반환.

    Args:
        quarter: 분기 코드 (예: "20241" = 2024년 1분기)
        debug:   True이면 URL·필드명·샘플 데이터 출력

    Returns:
        마포구 행정동 유동인구 row 리스트
    """
    all_rows: list[dict] = []
    start = 1

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            end = start + _PAGE_SIZE - 1
            url = _build_url(start, end, quarter)

            if debug:
                masked = url.replace(_api_key(), "***KEY***")
                print(f"[mapo_pop][DEBUG] GET {masked}")

            try:
                resp = await client.get(url)
                resp.raise_for_status()
            except httpx.HTTPError as e:
                print(f"[mapo_pop] HTTP 오류 (quarter={quarter}): {e}")
                break

            body = resp.json()

            if debug and not all_rows:
                print(f"[mapo_pop][DEBUG] 응답 최상위 키: {list(body.keys())}")

            service_data = body.get(_SERVICE, {})

            if not service_data:
                print(f"[mapo_pop] 응답에 '{_SERVICE}' 키 없음. 실제 키: {list(body.keys())}")
                break

            result = service_data.get("RESULT", {})
            code = result.get("CODE", "INFO-000")
            if code != "INFO-000":
                print(f"[mapo_pop] API 오류 [{code}]: {result.get('MESSAGE')}")
                break

            rows = service_data.get("row", [])

            if debug and rows and not all_rows:
                print(f"[mapo_pop][DEBUG] 첫 행 필드명: {list(rows[0].keys())}")
                print(f"[mapo_pop][DEBUG] 첫 행 샘플: { {k: v for k, v in list(rows[0].items())[:10]} }")

            all_rows.extend(rows)

            if len(rows) < _PAGE_SIZE:
                break
            start += _PAGE_SIZE

    if debug:
        print(f"[mapo_pop][DEBUG] {_SERVICE} 총 {len(all_rows)}행 수집 (필터링 전)")

    # 마포구 필터링 + 상권명 해석
    mapo_rows = []
    for row in all_rows:
        if not _is_mapo(row):
            continue
        dong_nm = row.get("ADSTRD_CD_NM", "")
        row = dict(row)  # 원본 변경 방지
        row["resolved_area"] = resolve_area(dong_nm)
        mapo_rows.append(row)

    print(f"[mapo_pop] 유동인구 수집: {len(mapo_rows)}건 (마포구 행정동) / 전체 {len(all_rows)}건 [quarter={quarter}]")
    return mapo_rows
