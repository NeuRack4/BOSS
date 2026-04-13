from fastapi import APIRouter, Depends
from supabase import Client

from backend.api.dependencies import db, get_current_user_id
from backend.api.schemas.draft import DraftResponse

router = APIRouter()


@router.get("/", response_model=list[DraftResponse])
async def list_drafts(
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    result = (
        supabase.table("drafts")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/{draft_id}", response_model=DraftResponse)
async def get_draft(
    draft_id: int,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    result = (
        supabase.table("drafts")
        .select("*")
        .eq("id", draft_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    return result.data
