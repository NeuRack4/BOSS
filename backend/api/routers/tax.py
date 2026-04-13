"""세금 기한 조회 + 공공데이터 동기화 API"""
from datetime import date
from fastapi import APIRouter, Query

from backend.agents.tax import get_upcoming_deadlines
from backend.data.crawlers.tax_calendar import upsert_tax_deadlines

router = APIRouter()


@router.get("/deadlines")
async def list_tax_deadlines(days_ahead: int = Query(default=30, ge=1, le=365)):
    """다가오는 세금 기한 목록 조회"""
    deadlines = await get_upcoming_deadlines(days_ahead=days_ahead)
    return {"deadlines": deadlines, "count": len(deadlines)}


@router.post("/deadlines/sync")
async def sync_tax_deadlines(year: int | None = Query(default=None)):
    """
    공공데이터포털에서 세금 기한 데이터를 가져와 DB에 저장.
    year 미지정 시 현재 연도 기준.
    """
    target_year = year or date.today().year
    count = await upsert_tax_deadlines(target_year)
    return {"synced": count, "year": target_year}
