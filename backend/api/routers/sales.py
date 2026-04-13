from fastapi import APIRouter, Depends, Query
from supabase import Client
from datetime import date
import calendar

from backend.api.dependencies import db, get_current_user_id
from backend.api.schemas.sale import SaleCreate, SaleResponse, SalesSummary
from backend.db.client import get_supabase

router = APIRouter()


def get_sales_summary(user_id: str, year: int, month: int) -> dict:
    """insights.py 등 내부 모듈에서 사용하는 월별 매출 요약 함수"""
    supabase = get_supabase()

    def fetch_month(y: int, m: int) -> list[dict]:
        last_day = calendar.monthrange(y, m)[1]
        return (
            supabase.table("sales")
            .select("amount, category, time_slot, date")
            .eq("user_id", user_id)
            .gte("date", f"{y}-{m:02d}-01")
            .lte("date", f"{y}-{m:02d}-{last_day:02d}")
            .execute()
            .data
        )

    cur = fetch_month(year, month)
    prev_year, prev_month = (year - 1, 12) if month == 1 else (year, month - 1)
    prev = fetch_month(prev_year, prev_month)

    def aggregate(rows: list[dict]) -> dict:
        total = sum(r["amount"] for r in rows)
        by_cat: dict[str, int] = {}
        by_slot: dict[str, int] = {}
        for r in rows:
            by_cat[r["category"]] = by_cat.get(r["category"], 0) + r["amount"]
            by_slot[r["time_slot"]] = by_slot.get(r["time_slot"], 0) + r["amount"]
        days = calendar.monthrange(year, month)[1]
        return {
            "total": total,
            "count": len(rows),
            "daily_avg": total // days if days else 0,
            "category_breakdown": by_cat,
            "timeslot_breakdown": by_slot,
            "entries": [{"date": r["date"], "amount": r["amount"]} for r in rows],
        }

    c = aggregate(cur)
    p = aggregate(prev)
    change_pct = (
        round((c["total"] - p["total"]) / p["total"] * 100, 1)
        if p["total"] > 0 else None
    )

    return {
        "current_total": c["total"],
        "prev_total": p["total"],
        "change_pct": change_pct,
        "transaction_count": c["count"],
        "daily_average": c["daily_avg"],
        "category_breakdown": c["category_breakdown"],
        "timeslot_breakdown": c["timeslot_breakdown"],
        "entries": c["entries"],
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
