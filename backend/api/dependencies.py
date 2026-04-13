from fastapi import Depends, HTTPException, Header
from supabase import Client
from backend.db.client import get_supabase


async def db(supabase: Client = Depends(get_supabase)) -> Client:
    return supabase


async def get_current_user_id(
    x_user_id: str = Header(..., description="Supabase Auth user UUID"),
) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    return x_user_id
