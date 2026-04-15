import calendar
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client
from datetime import date

from backend.api.dependencies import db, get_current_user_id
from backend.api.schemas.expense import ExpenseCreate, ExpenseResponse, ExpenseUpdate
from backend.db.client import get_supabase

router = APIRouter()


async def get_expense_summary(user_id: str, year: int, month: int) -> dict:
    """월별 비용 요약 — insights 및 dashboard 공용"""
    supabase = get_supabase()

    _, last_day = calendar.monthrange(year, month)
    from_date = date(year, month, 1)
    to_date = date(year, month, last_day)

    rows = (
        supabase.table("expenses")
        .select("*")
        .eq("user_id", user_id)
        .gte("date", str(from_date))
        .lte("date", str(to_date))
        .execute()
        .data
    )

    total = sum(r["amount"] for r in rows)
    breakdown: dict[str, int] = {}
    for r in rows:
        cat = r.get("category", "other")
        breakdown[cat] = breakdown.get(cat, 0) + r["amount"]

    return {
        "total_expenses": total,
        "breakdown": breakdown,
        "entries": rows,
    }


@router.post("/", response_model=ExpenseResponse, status_code=201)
async def create_expense(
    body: ExpenseCreate,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    result = (
        supabase.table("expenses")
        .insert({**body.model_dump(mode="json"), "user_id": user_id})
        .execute()
    )
    return result.data[0]


@router.get("/", response_model=list[ExpenseResponse])
async def list_expenses(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    query = supabase.table("expenses").select("*").eq("user_id", user_id)
    if from_date:
        query = query.gte("date", str(from_date))
    if to_date:
        query = query.lte("date", str(to_date))
    result = query.order("date", desc=True).execute()
    return result.data


@router.get("/summary")
async def expense_summary(
    year: int = Query(default=None),
    month: int = Query(default=None),
    user_id: str = Depends(get_current_user_id),
):
    today = date.today()
    return await get_expense_summary(
        user_id=user_id,
        year=year or today.year,
        month=month or today.month,
    )


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: str,
    body: ExpenseUpdate,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    existing = (
        supabase.table("expenses")
        .select("id")
        .eq("id", expense_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="비용 데이터를 찾을 수 없습니다.")

    update_data = {k: v for k, v in body.model_dump(mode="json").items() if v is not None}
    result = supabase.table("expenses").update(update_data).eq("id", expense_id).execute()
    return result.data[0]


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    existing = (
        supabase.table("expenses")
        .select("id")
        .eq("id", expense_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="비용 데이터를 찾을 수 없습니다.")

    supabase.table("expenses").delete().eq("id", expense_id).execute()
