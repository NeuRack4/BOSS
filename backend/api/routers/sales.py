import calendar
from fastapi import APIRouter, Depends, Query
from supabase import Client
from datetime import date

from backend.api.dependencies import db, get_current_user_id
from backend.api.schemas.sale import SaleCreate, SaleResponse
from backend.db.client import get_supabase

router = APIRouter()


async def get_sales_summary(user_id: str, year: int, month: int) -> dict:
    """월별 매출 요약 — insights 및 dashboard 공용"""
    supabase = get_supabase()

    # 이번달 날짜 범위
    _, last_day = calendar.monthrange(year, month)
    from_date = date(year, month, 1)
    to_date = date(year, month, last_day)

    # 전달 날짜 범위
    if month == 1:
        prev_year, prev_month = year - 1, 12
    else:
        prev_year, prev_month = year, month - 1
    _, prev_last_day = calendar.monthrange(prev_year, prev_month)
    prev_from = date(prev_year, prev_month, 1)
    prev_to = date(prev_year, prev_month, prev_last_day)

    # 이번달 매출 조회
    rows = (
        supabase.table("sales")
        .select("*")
        .eq("user_id", user_id)
        .gte("date", str(from_date))
        .lte("date", str(to_date))
        .execute()
        .data
    )

    # 전달 매출 조회
    prev_rows = (
        supabase.table("sales")
        .select("amount")
        .eq("user_id", user_id)
        .gte("date", str(prev_from))
        .lte("date", str(prev_to))
        .execute()
        .data
    )

    current_total = sum(r["amount"] for r in rows)
    prev_total = sum(r["amount"] for r in prev_rows)

    change_pct = (
        round((current_total - prev_total) / prev_total * 100, 1)
        if prev_total > 0
        else None
    )

    today = date.today()
    days_elapsed = today.day if (year == today.year and month == today.month) else last_day
    daily_average = round(current_total / days_elapsed) if days_elapsed > 0 else 0

    category_breakdown: dict[str, int] = {}
    timeslot_breakdown: dict[str, int] = {}
    for r in rows:
        cat = r.get("category", "기타")
        slot = r.get("time_slot", "기타")
        category_breakdown[cat] = category_breakdown.get(cat, 0) + r["amount"]
        timeslot_breakdown[slot] = timeslot_breakdown.get(slot, 0) + r["amount"]

    return {
        "current_total": current_total,
        "prev_total": prev_total,
        "change_pct": change_pct,
        "transaction_count": len(rows),
        "daily_average": daily_average,
        "category_breakdown": category_breakdown,
        "timeslot_breakdown": timeslot_breakdown,
        "entries": [{"date": r["date"], "amount": r["amount"]} for r in rows],
    }


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


@router.get("/summary")
async def sales_summary(
    year: int = Query(default=None),
    month: int = Query(default=None),
    user_id: str = Depends(get_current_user_id),
):
    today = date.today()
    return await get_sales_summary(
        user_id=user_id,
        year=year or today.year,
        month=month or today.month,
    )
