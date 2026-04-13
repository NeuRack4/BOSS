"""세금 기한 조회 + 초안 생성 + 공공데이터 동기화 API"""
from datetime import date
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.agents.tax import get_upcoming_deadlines, generate_tax_draft
from backend.data.crawlers.tax_calendar import upsert_tax_deadlines
from backend.db.client import get_supabase

router = APIRouter()


class DraftRequest(BaseModel):
    user_id: str
    deadline_id: int


@router.get("/deadlines")
async def list_tax_deadlines(days_ahead: int = Query(default=30, ge=1, le=365)):
    """다가오는 세금 기한 목록 조회"""
    deadlines = await get_upcoming_deadlines(days_ahead=days_ahead)
    return {"deadlines": deadlines, "count": len(deadlines)}


@router.post("/draft")
async def create_tax_draft(body: DraftRequest):
    """
    세금 신고서 초안 생성.
    deadline_id로 tax_deadlines 테이블 조회 후 Claude API로 초안 생성 → Supabase Storage 저장.
    """
    row = (
        get_supabase()
        .table("tax_deadlines")
        .select("id, tax_type, title, deadline_date, description, source_url")
        .eq("id", body.deadline_id)
        .maybe_single()
        .execute()
        .data
    )
    if not row:
        raise HTTPException(status_code=404, detail="deadline not found")

    storage_path = await generate_tax_draft(user_id=body.user_id, deadline=row)
    return {"storage_path": storage_path, "deadline_id": body.deadline_id}


@router.post("/deadlines/sync")
async def sync_tax_deadlines(year: int | None = Query(default=None)):
    """
    공공데이터포털에서 세금 기한 데이터를 가져와 DB에 저장.
    year 미지정 시 현재 연도 기준.
    """
    target_year = year or date.today().year
    count = await upsert_tax_deadlines(target_year)
    return {"synced": count, "year": target_year}
