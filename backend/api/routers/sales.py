from fastapi import APIRouter, Depends, Query
from supabase import Client
from datetime import date
import calendar

from backend.api.dependencies import db, get_current_user_id
from backend.api.schemas.sale import SaleCreate, SaleResponse, SalesSummary
from backend.db.client import get_supabase

router = APIRouter()


async def get_sales_summary(user_id: str, year: int, month: int) -> dict:
    """인사이트 분석용 월별 매출 요약 반환"""
    supabase = get_supabase()

    # 이번 달 범위
    last_day = calendar.monthrange(year, month)[1]
    from_date = date(year, month, 1)
    to_date = date(year, month, last_day)

    rows = (
        supabase.table("sales")
        .select("amount, category, time_slot, date")
        .eq("user_id", user_id)
        .gte("date", str(from_date))
        .lte("date", str(to_date))
        .execute()
    ).data

    current_total = sum(r["amount"] for r in rows)
    category_breakdown: dict[str, int] = {}
    timeslot_breakdown: dict[str, int] = {}
    for r in rows:
        category_breakdown[r["category"]] = category_breakdown.get(r["category"], 0) + r["amount"]
        timeslot_breakdown[r["time_slot"]] = timeslot_breakdown.get(r["time_slot"], 0) + r["amount"]

    daily_average = current_total // last_day if current_total else 0

    # 전달 범위
    if month == 1:
        prev_year, prev_month = year - 1, 12
    else:
        prev_year, prev_month = year, month - 1
    prev_last_day = calendar.monthrange(prev_year, prev_month)[1]
    prev_from = date(prev_year, prev_month, 1)
    prev_to = date(prev_year, prev_month, prev_last_day)

    prev_rows = (
        supabase.table("sales")
        .select("amount")
        .eq("user_id", user_id)
        .gte("date", str(prev_from))
        .lte("date", str(prev_to))
        .execute()
    ).data
    prev_total = sum(r["amount"] for r in prev_rows)

    change_pct = None
    if prev_total > 0:
        change_pct = round((current_total - prev_total) / prev_total * 100, 1)

    return {
        "current_total": current_total,
        "prev_total": prev_total,
        "change_pct": change_pct,
        "transaction_count": len(rows),
        "daily_average": daily_average,
        "category_breakdown": category_breakdown,
        "timeslot_breakdown": timeslot_breakdown,
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
    from datetime import date as date_cls
    today = date_cls.today()
    return await get_sales_summary(
        user_id=user_id,
        year=year or today.year,
        month=month or today.month,
    )


@router.get("/summary/legacy", response_model=SalesSummary)
async def sales_summary_legacy(
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
