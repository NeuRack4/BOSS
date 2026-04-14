"""
기상청 ASOS 일별 날씨 데이터 크롤러 (공공데이터포털)

API: /1360000/AsosDalyInfoService/getWthrDataList
관측소: 서울 (stnIds=108)
제공: 기상청
비용: 무료 (일 10,000 콜 제한)

.env 설정:
  PUBLIC_DATA_API_KEY=발급받은_인증키 (공공데이터포털)

반환 필드:
  avgTa   — 평균기온 (℃)
  sumRn   — 강수량 합계 (mm)
  maxWs   — 최대풍속 (m/s)
  avgRhm  — 평균습도 (%)
"""

import xml.etree.ElementTree as ET
from datetime import date, timedelta
import httpx
from backend.core.config import get_settings

_BASE_URL = "https://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList"
_STN_IDS = "108"  # 서울 관측소


def _api_key() -> str:
    key = get_settings().public_data_api_key
    if not key:
        raise ValueError(
            "PUBLIC_DATA_API_KEY가 .env에 설정되지 않았습니다.\n"
            "공공데이터포털(data.go.kr)에서 기상청 API 키를 발급받아\n"
            "PUBLIC_DATA_API_KEY=발급받은키 형식으로 .env에 추가해주세요."
        )
    return key


def _parse_float(val: str | None) -> float | None:
    """빈 문자열이나 None을 None으로, 숫자 문자열을 float으로 변환."""
    if not val or val.strip() == "":
        return None
    try:
        return float(val.strip())
    except ValueError:
        return None


async def fetch_weather_range(start: date, end: date) -> list[dict]:
    """
    start ~ end 기간의 일별 날씨 데이터를 반환합니다.

    반환 형식:
        [
            {
                "date": date(2024, 1, 1),
                "avg_temp": 2.3,
                "rain_mm": 0.0,
                "max_wind": 4.5,
                "avg_humid": 68.0,
            },
            ...
        ]
    """
    # 기상청 API는 params 딕셔너리 방식으로 전달해야 정상 동작 (URL 직접 삽입 시 403)
    params = {
        "serviceKey": _api_key(),
        "pageNo": 1,
        "numOfRows": 999,
        "dataType": "XML",
        "dataCd": "ASOS",
        "dateCd": "DAY",
        "startDt": start.strftime("%Y%m%d"),
        "endDt": end.strftime("%Y%m%d"),
        "stnIds": _STN_IDS,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(_BASE_URL, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            print(f"[weather] HTTP 오류 ({start}~{end}): {e}")
            return []

    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError as e:
        print(f"[weather] XML 파싱 오류 ({start}~{end}): {e}")
        return []

    # 에러 코드 확인
    result_code = root.findtext(".//resultCode", "")
    if result_code and result_code != "00":
        msg = root.findtext(".//resultMsg", "")
        print(f"[weather] API 오류 [{result_code}]: {msg}")
        return []

    results = []
    for item in root.findall(".//item"):
        tm = item.findtext("tm", "").strip()  # 일시 (YYYY-MM-DD)
        if not tm:
            continue

        try:
            obs_date = date.fromisoformat(tm)
        except ValueError:
            continue

        avg_temp = _parse_float(item.findtext("avgTa"))
        rain_mm = _parse_float(item.findtext("sumRn"))
        max_wind = _parse_float(item.findtext("maxWs"))
        avg_humid = _parse_float(item.findtext("avgRhm"))

        results.append(
            {
                "date": obs_date,
                "avg_temp": avg_temp,
                "rain_mm": rain_mm if rain_mm is not None else 0.0,
                "max_wind": max_wind,
                "avg_humid": avg_humid,
            }
        )

    return results


async def fetch_weather_year(year: int) -> list[dict]:
    """연도 전체 날씨 데이터를 반환합니다 (월별 분할 요청)."""
    import asyncio

    today = date.today()
    tasks = []
    for month in range(1, 13):
        m_start = date(year, month, 1)
        # 미래 월은 건너뜀
        if m_start > today:
            break
        # 월 마지막 날 계산
        if month == 12:
            m_end = date(year, 12, 31)
        else:
            m_end = date(year, month + 1, 1) - timedelta(days=1)
        m_end = min(m_end, today)
        tasks.append(fetch_weather_range(m_start, m_end))

    month_results = await asyncio.gather(*tasks)
    return [item for month in month_results for item in month]
