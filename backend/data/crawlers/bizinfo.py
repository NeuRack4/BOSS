"""
기업마당 공공 API 크롤러 (https://www.bizinfo.go.kr)
마포구 카페 관련 지원사업 공고를 수집합니다.

API 문서: https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do
사용 전 robots.txt 및 이용약관 확인 완료.
"""
import httpx
from datetime import date
from backend.core.config import get_settings
from backend.core.constants import BusinessType

_BASE_URL = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do"


async def fetch_programs(
    business_type: BusinessType = BusinessType.CAFE,
    region: str = "마포구",
    page: int = 1,
    per_page: int = 20,
) -> list[dict]:
    """기업마당 API에서 지원사업 목록 조회"""
    settings = get_settings()

    # 업종 매핑
    industry_code = {"cafe": "I56", "bakery": "I56", "snack": "I56"}.get(
        business_type, "I56"
    )  # 음식점업

    params = {
        "authKey": settings.bizinfo_api_key,
        "returnType": "json",
        "pageUnit": per_page,
        "pageIndex": page,
        "indsLclsCd": industry_code,
        "rgnSeCode": "02",  # 서울
        "pblancNm": "마포",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(_BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()

    items = data.get("items", [])
    return [_parse_program(item) for item in items]


def _parse_program(item: dict) -> dict:
    return {
        "id": item.get("pblancId", ""),
        "title": item.get("pblancNm", ""),
        "organization": item.get("jrsdInsttNm", ""),
        "deadline": item.get("reqstEndDe", ""),
        "url": item.get("detailUrl", ""),
        "score": 0.0,  # 매칭 스코어는 에이전트가 계산
    }
