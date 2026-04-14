from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from supabase import Client

from backend.api.dependencies import db, get_current_user_id
from backend.data.sync.subsidy_sync import sync_daily_if_needed

router = APIRouter()


@router.get("/matches")
async def get_matches(
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    result = (
        supabase.table("subsidy_matches")
        .select("*")
        .eq("user_id", user_id)
        .order("score", desc=True)
        .execute()
    )
    return result.data


@router.post("/matches/{match_id}/apply")
async def mark_applied(
    match_id: int,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    result = (
        supabase.table("subsidy_matches")
        .update({"status": "applied"})
        .eq("id", match_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0]


# ------------------------------------------------------------
# 지원사업 캘린더 — Feature 3
# ------------------------------------------------------------

@router.get("/calendar")
async def get_calendar(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    region: Optional[str] = Query(None),
    business_type: Optional[str] = Query(None),
    supabase: Client = Depends(db),
):
    """
    기간 내 공고 목록 조회.
    - from/to 와 [start_date, end_date] 구간이 겹치는 행 반환
    - region / business_type 필터 (미지정 시 전체)
    """
    query = (
        supabase.table("subsidy_programs")
        .select(
            "id, external_id, title, organization, region, business_type, "
            "start_date, end_date, description, detail_url"
        )
        .lte("start_date", to_date.isoformat())
        .gte("end_date", from_date.isoformat())
        .order("start_date", desc=False)
        .limit(500)
    )
    if region:
        query = query.eq("region", region)
    if business_type:
        query = query.eq("business_type", business_type)

    result = query.execute()
    return result.data or []


@router.post("/sync-today")
async def sync_today():
    """
    페이지 진입 시 호출. 오늘 자 동기화 로그가 없으면 증분 수집.
    동시 호출은 subsidy_fetch_log.fetch_date PK 로 보호.
    """
    executed, count = await sync_daily_if_needed()
    return {"executed": executed, "count": count}
