from fastapi import APIRouter, Depends
from supabase import Client

from backend.api.dependencies import db, get_current_user_id

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
