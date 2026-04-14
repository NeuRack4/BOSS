"""
한국천문연구원 특일 정보 API 크롤러 (공공데이터포털)

API: B090041/openapi/service/SpcdeInfoService/getRestDeInfo
제공: 한국천문연구원
비용: 무료 (일 10,000 콜 제한)
이용약관: 공공누리 1유형

.env 설정:
  PUBLIC_DATA_API_KEY=발급받은_인증키 (공공데이터포털)

API 키 발급:
  1. data.go.kr 접속 → 회원가입 → 로그인
  2. 검색: "한국천문연구원 특일 정보"
  3. 활용신청 → 즉시 발급 (자동승인)
"""
import xml.etree.ElementTree as ET
import httpx
from backend.core.config import get_settings

_BASE_URL = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"


def _api_key() -> str:
    key = get_settings().public_data_api_key
    if not key:
        raise ValueError(
            "PUBLIC_DATA_API_KEY가 .env에 설정되지 않았습니다.\n"
            "공공데이터포털(data.go.kr)에서 '한국천문연구원 특일 정보' API 키를 발급받아\n"
            "PUBLIC_DATA_API_KEY=발급받은키 형식으로 .env에 추가해주세요."
        )
    return key


async def fetch_holidays_by_month(year: int, month: int) -> list[dict]:
    """
    특정 연월의 공휴일 목록을 반환합니다. (XML 응답 파싱)

    반환 형식:
        [{"date": "20240101", "name": "신정"}, ...]
    """
    # 공공데이터포털 API는 serviceKey를 URL에 직접 삽입해야 함
    # (params 딕셔너리로 전달 시 이중 URL 인코딩 문제 발생)
    url = (
        f"{_BASE_URL}"
        f"?serviceKey={_api_key()}"
        f"&solYear={year}"
        f"&solMonth={month:02d}"
        f"&numOfRows=50"
    )

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            print(f"[holiday] HTTP 오류 ({year}-{month:02d}): {e}")
            return []

    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError as e:
        print(f"[holiday] XML 파싱 오류 ({year}-{month:02d}): {e}")
        return []

    # 에러 코드 확인
    result_code = root.findtext(".//resultCode", "")
    if result_code and result_code != "0000":
        msg = root.findtext(".//resultMsg", "")
        print(f"[holiday] API 오류 [{result_code}]: {msg}")
        return []

    results = []
    for item in root.findall(".//item"):
        date_str = item.findtext("locdate", "").strip()
        name = item.findtext("dateName", "").strip()
        is_hol = item.findtext("isHoliday", "N").strip()
        if date_str and is_hol == "Y":
            results.append({"date": date_str, "name": name})

    return results


async def fetch_holidays_by_year(year: int) -> dict[str, str]:
    """
    특정 연도의 공휴일 전체를 반환합니다.

    반환 형식:
        {"20240101": "신정", "20240209": "설날 연휴", ...}
    """
    import asyncio
    tasks = [fetch_holidays_by_month(year, m) for m in range(1, 13)]
    results = await asyncio.gather(*tasks)

    holidays: dict[str, str] = {}
    for month_result in results:
        for item in month_result:
            holidays[item["date"]] = item["name"]

    return holidays
