"""
공공데이터포털 세금 기한 크롤러
- 공공데이터포털 국세청 세금 납부기한 API 호출
- API 실패 시 seeds/tax_deadlines_seed.py fallback 사용
- upsert_tax_deadlines()로 Supabase tax_deadlines 테이블에 저장
"""
import httpx
from datetime import date

from backend.core.config import get_settings
from backend.db.client import get_supabase

# 공공데이터포털 국세청 세금납부기한 서비스
# 실제 엔드포인트: https://www.data.go.kr 에서 "국세청 세금납부기한" 검색
_API_BASE = "https://api.odcloud.kr/api"
_ENDPOINT = "/15013282/v1/uddi:5e5a34ed-7c1a-4b5c-b5a5-8e5d3a2f1c9b"


async def fetch_tax_calendar(year: int) -> list[dict]:
    """
    공공데이터포털에서 해당 연도 세금 기한 조회.
    API 미응답·파싱 실패 시 시드 데이터로 자동 대체.
    """
    settings = get_settings()

    if not settings.public_data_api_key:
        return _fallback(year)

    params = {
        "page": 1,
        "perPage": 100,
        "serviceKey": settings.public_data_api_key,
        "cond[과세연도::EQ]": str(year),
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(f"{_API_BASE}{_ENDPOINT}", params=params)
            resp.raise_for_status()
            data = resp.json()
            parsed = _parse_response(data, year)
            if not parsed:
                return _fallback(year)
            return parsed
        except (httpx.HTTPError, KeyError, ValueError):
            return _fallback(year)


def _parse_response(data: dict, year: int) -> list[dict]:
    """공공데이터포털 응답 → tax_deadlines 레코드 변환"""
    items = data.get("data", [])
    result = []
    for item in items:
        deadline_str = item.get("납부기한일") or item.get("신고기한일", "")
        if not deadline_str:
            continue
        result.append({
            "tax_type": _map_tax_type(item.get("세목코드", "")),
            "title": item.get("신고납부종류", item.get("항목명", "")),
            "deadline_date": deadline_str,
            "year": year,
            "description": item.get("내용", ""),
            "source_url": "https://www.hometax.go.kr",
        })
    return result


def _map_tax_type(code: str) -> str:
    mapping = {
        "V": "vat",
        "I": "income",
        "W": "withholding",
        "C": "corporate",
    }
    return mapping.get(code[:1].upper(), "etc")


def _fallback(year: int) -> list[dict]:
    from backend.data.seeds.tax_deadlines_seed import get_seed_deadlines
    return get_seed_deadlines(year)


async def upsert_tax_deadlines(year: int | None = None) -> int:
    """
    세금 기한 데이터를 Supabase tax_deadlines 테이블에 upsert.
    반환: 처리된 건수
    """
    target_year = year or date.today().year
    deadlines = await fetch_tax_calendar(target_year)

    if not deadlines:
        return 0

    supabase = get_supabase()
    supabase.table("tax_deadlines").upsert(
        deadlines,
        on_conflict="tax_type,deadline_date,year",
    ).execute()

    return len(deadlines)
