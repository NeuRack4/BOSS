from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from supabase import Client

from backend.api.dependencies import db, get_current_user_id
from backend.data.sync.subsidy_sync import sync_daily_if_needed
from backend.rag.embeddings.bge_embeddings import embed_single

router = APIRouter()

_BASE_COLS = (
    "id, external_id, title, organization, region, program_kind, sub_kind, "
    "target, start_date, end_date, period_raw, is_ongoing, description, "
    "detail_url, external_url, hashtags"
)


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
    supabase: Client = Depends(db),
):
    """
    기간 내 공고 목록 (is_ongoing=false 만).
    start_date ≤ to AND end_date ≥ from 으로 겹치는 행 반환.
    """
    query = (
        supabase.table("subsidy_programs")
        .select(_BASE_COLS)
        .eq("is_ongoing", False)
        .lte("start_date", to_date.isoformat())
        .gte("end_date", from_date.isoformat())
        .order("start_date", desc=False)
        .limit(500)
    )
    if region:
        query = query.eq("region", region)

    result = query.execute()
    return result.data or []


@router.get("/ongoing")
async def get_ongoing(
    region: Optional[str] = Query(None),
    supabase: Client = Depends(db),
):
    """상시 모집 공고 리스트 (기간 파싱 불가 — '예산 소진시까지' 등)."""
    query = (
        supabase.table("subsidy_programs")
        .select(_BASE_COLS)
        .eq("is_ongoing", True)
        .order("fetched_at", desc=True)
        .limit(200)
    )
    if region:
        query = query.eq("region", region)

    result = query.execute()
    return result.data or []


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    match_count: int = Field(10, ge=1, le=30)


@router.post("/search")
async def search_subsidies(
    request: SearchRequest,
    supabase: Client = Depends(db),
):
    """하이브리드 검색 (벡터 + FTS + trigram → RRF) on subsidy_programs."""
    embedding = await embed_single(request.query)
    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

    result = supabase.rpc(
        "search_subsidies",
        {
            "query_text": request.query,
            "query_embedding": embedding_str,
            "match_count": request.match_count,
        },
    ).execute()

    return result.data or []


@router.post("/sync-today")
async def sync_today():
    """
    페이지 진입 시 호출. 오늘 자 동기화 로그가 없으면 스냅샷 수집.
    동시 호출은 subsidy_fetch_log.fetch_date PK 로 보호.
    """
    executed, count = await sync_daily_if_needed()
    return {"executed": executed, "count": count}
