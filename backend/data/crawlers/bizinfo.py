"""
기업마당 공공 API 크롤러 (https://www.bizinfo.go.kr)
서울(마포) F&B 지원사업 공고를 수집합니다.

API 문서: https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do
사용 전 robots.txt 및 이용약관 확인 완료.
"""
import asyncio
import httpx
from datetime import date, datetime
from typing import Optional
from backend.core.config import get_settings
from backend.core.constants import BusinessType

_BASE_URL = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do"

_INDUSTRY_CODE = {"cafe": "I56", "bakery": "I56", "snack": "I56"}


async def fetch_programs(
    business_type: BusinessType = BusinessType.CAFE,
    region: str = "마포구",
    page: int = 1,
    per_page: int = 20,
) -> list[dict]:
    """기업마당 API에서 지원사업 목록 1페이지 조회 (마감임박 필터)."""
    settings = get_settings()
    params = {
        "authKey": settings.bizinfo_api_key,
        "returnType": "json",
        "pageUnit": per_page,
        "pageIndex": page,
        "indsLclsCd": _INDUSTRY_CODE.get(business_type, "I56"),
        "rgnSeCode": "02",  # 서울
        "pblancNm": region,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(_BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()
    items = data.get("items", [])
    return [_parse_program(item) for item in items]


async def fetch_all_programs(
    business_type: Optional[BusinessType] = BusinessType.CAFE,
    region: Optional[str] = None,
    per_page: int = 100,
    max_pages: int = 50,
    sleep_between: float = 0.3,
) -> list[dict]:
    """
    페이징 루프로 가능한 모든 공고 수집.
    region 미지정 시 전국 필터 해제.
    백필/증분 수집에 공용 사용.
    """
    settings = get_settings()
    results: list[dict] = []
    seen_ids: set[str] = set()

    async with httpx.AsyncClient(timeout=15.0) as client:
        for page in range(1, max_pages + 1):
            params = {
                "authKey": settings.bizinfo_api_key,
                "returnType": "json",
                "pageUnit": per_page,
                "pageIndex": page,
                "rgnSeCode": "02",
            }
            if business_type:
                params["indsLclsCd"] = _INDUSTRY_CODE.get(business_type, "I56")
            if region:
                params["pblancNm"] = region

            try:
                response = await client.get(_BASE_URL, params=params)
                response.raise_for_status()
                data = response.json()
            except (httpx.HTTPError, ValueError):
                break

            items = data.get("items", [])
            if not items:
                break

            new_count = 0
            for item in items:
                parsed = _parse_program_detail(item)
                ext_id = parsed.get("external_id")
                if not ext_id or ext_id in seen_ids:
                    continue
                seen_ids.add(ext_id)
                results.append(parsed)
                new_count += 1

            if new_count == 0 or len(items) < per_page:
                break

            await asyncio.sleep(sleep_between)

    return results


def _parse_program(item: dict) -> dict:
    """기존 /matches 경로용 경량 파서."""
    return {
        "id": item.get("pblancId", ""),
        "title": item.get("pblancNm", ""),
        "organization": item.get("jrsdInsttNm", ""),
        "deadline": item.get("reqstEndDe", ""),
        "url": item.get("detailUrl", ""),
        "score": 0.0,
    }


def _parse_program_detail(item: dict) -> dict:
    """DB 적재용 상세 파서 — subsidy_programs 테이블 스키마에 매핑."""
    start = _parse_date(item.get("reqstBeginDe"))
    end = _parse_date(item.get("reqstEndDe"))
    title: str = item.get("pblancNm", "") or ""
    return {
        "external_id": str(item.get("pblancId", "")).strip(),
        "title": title,
        "organization": item.get("jrsdInsttNm") or None,
        "region": _infer_region(title, item.get("rgnSeCode")),
        "business_type": _infer_business_type(item.get("indsLclsCd"), title),
        "start_date": start.isoformat() if start else None,
        "end_date": end.isoformat() if end else None,
        "description": item.get("bsnsSumryCn") or item.get("pblancBgng") or None,
        "detail_url": item.get("pblancUrl") or item.get("detailUrl") or None,
        "raw": item,
    }


def _parse_date(raw: Optional[str]) -> Optional[date]:
    if not raw:
        return None
    raw = str(raw).strip().replace(".", "-").replace("/", "-")
    for fmt in ("%Y-%m-%d", "%Y%m%d"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _infer_region(title: str, rgn_code: Optional[str]) -> Optional[str]:
    if title and "마포" in title:
        return "마포구"
    if rgn_code == "02":
        return "서울"
    return "전국"


def _infer_business_type(inds_code: Optional[str], title: str) -> Optional[str]:
    if inds_code == "I56":
        if title:
            if "베이커리" in title or "제과" in title:
                return "bakery"
            if "분식" in title:
                return "snack"
        return "cafe"
    return None
