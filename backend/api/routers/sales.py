from fastapi import APIRouter, Depends, Query
from supabase import Client
from datetime import date

from backend.api.dependencies import db, get_current_user_id
from backend.api.schemas.sale import SaleCreate, SaleResponse, SalesSummary

router = APIRouter()


@router.post("/", response_model=SaleResponse, status_code=201)
async def create_sale(
    body: SaleCreate,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    result = (
        supabase.table("sales")
        .insert({**body.model_dump(mode="json"), "user_id": user_id})
        .execute()
    )
    return result.data[0]


@router.get("/", response_model=list[SaleResponse])
async def list_sales(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    query = supabase.table("sales").select("*").eq("user_id", user_id)
    if from_date:
        query = query.gte("date", str(from_date))
    if to_date:
        query = query.lte("date", str(to_date))
    result = query.order("date", desc=True).execute()
    return result.data


@router.get("/summary", response_model=SalesSummary)
async def sales_summary(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    query = supabase.table("sales").select("amount, category, time_slot").eq("user_id", user_id)
    if from_date:
        query = query.gte("date", str(from_date))
    if to_date:
        query = query.lte("date", str(to_date))
    rows = query.execute().data

    by_category: dict[str, int] = {}
    by_time_slot: dict[str, int] = {}
    total = 0

    for row in rows:
        total += row["amount"]
        by_category[row["category"]] = by_category.get(row["category"], 0) + row["amount"]
        by_time_slot[row["time_slot"]] = by_time_slot.get(row["time_slot"], 0) + row["amount"]

    peak = max(by_time_slot, key=by_time_slot.get) if by_time_slot else None

    return SalesSummary(
        total_amount=total,
        by_category=by_category,
        by_time_slot=by_time_slot,
        peak_time_slot=peak,
        record_count=len(rows),
    )
