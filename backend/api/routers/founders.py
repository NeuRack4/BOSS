from fastapi import APIRouter, Depends
from supabase import Client

from backend.api.dependencies import db, get_current_user_id
from backend.api.schemas.founder import FounderCreate, FounderStateUpdate, FounderResponse

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
    result = supabase.table("users").select("*").eq("id", user_id).single().execute()
    return result.data


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
