from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.api.dependencies import db, get_current_user_id
from backend.api.schemas.founder import (
    FounderCreate,
    FounderProfileUpsert,
    FounderStateUpdate,
    FounderResponse,
)

router = APIRouter()


@router.post("/", response_model=FounderResponse, status_code=201)
async def create_founder(body: FounderCreate, supabase: Client = Depends(db)):
    result = (
        supabase.table("users")
        .insert(body.model_dump())
        .execute()
    )
    return result.data[0]


@router.get("/me", response_model=FounderResponse)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    result = supabase.table("users").select("*").eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="프로필이 없습니다. 온보딩을 완료해주세요.")
    row = result.data[0]
    row.setdefault("profile", {})
    return row


@router.put("/me")
async def upsert_profile(
    body: FounderProfileUpsert,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    """온보딩 완료 또는 마이페이지 수정 시 프로필 저장/갱신"""
    profile_data = body.model_dump()
    biz_type = body.business_type if body.business_type in ("cafe", "bakery", "snack") else "cafe"
    region = f"서울시 {body.district}" if body.district else "마포구"

    supabase.table("users").upsert(
        {
            "id": user_id,
            "email": body.email,
            "business_type": biz_type,
            "region": region,
            "profile": profile_data,
        },
        on_conflict="id",
    ).execute()

    return {"ok": True}


@router.put("/me/state")
async def update_state(
    body: FounderStateUpdate,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    data = body.model_dump()
    data["user_id"] = user_id

    result = (
        supabase.table("founder_state")
        .upsert(data, on_conflict="user_id")
        .execute()
    )
    return result.data[0]
