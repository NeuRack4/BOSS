from fastapi import APIRouter, Depends
from supabase import Client

from backend.api.dependencies import db, get_current_user_id
from backend.api.schemas.trigger import TriggerLogResponse

router = APIRouter()


@router.get("/", response_model=list[TriggerLogResponse])
async def list_triggers(
    unread_only: bool = False,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    query = supabase.table("trigger_log").select("*").eq("user_id", user_id)
    if unread_only:
        query = query.is_("read_at", "null")
    result = query.order("sent_at", desc=True).execute()
    return result.data


@router.patch("/{trigger_id}/read")
async def mark_read(
    trigger_id: int,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    from datetime import datetime, timezone
    result = (
        supabase.table("trigger_log")
        .update({"read_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", trigger_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0]
