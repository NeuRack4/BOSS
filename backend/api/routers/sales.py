import calendar
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client
from datetime import date

from backend.api.dependencies import db, get_current_user_id
from backend.api.schemas.sale import SaleCreate, SaleResponse, SaleUpdate, SalesSummary
from backend.db.client import get_supabase

router = APIRouter()


def _query_sales_items(supabase, user_id: str, from_date: date, to_date: date) -> list[dict]:
    """sales_items 테이블에서 날짜 범위 조회"""
    return (
        supabase.table("sales_items")
        .select("amount, date, category, time_slot, receipt_id")
        .eq("user_id", user_id)
        .gte("date", str(from_date))
        .lte("date", str(to_date))
        .execute()
        .data or []
    )


async def get_sales_summary(user_id: str, year: int, month: int) -> dict:
    """월별 매출 요약 — insights 및 dashboard 공용 (sales_items 기반)"""
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

    # 전년 동월 날짜 범위
    _, yoy_last_day = calendar.monthrange(year - 1, month)
    yoy_from = date(year - 1, month, 1)
    yoy_to = date(year - 1, month, yoy_last_day)

    # sales_items 테이블에서 조회
    rows = _query_sales_items(supabase, user_id, from_date, to_date)
    prev_rows = _query_sales_items(supabase, user_id, prev_from, prev_to)
    yoy_rows = _query_sales_items(supabase, user_id, yoy_from, yoy_to)

    current_total = sum(r["amount"] for r in rows)
    prev_total = sum(r["amount"] for r in prev_rows)
    yoy_total = sum(r["amount"] for r in yoy_rows)

    change_pct = (
        round((current_total - prev_total) / prev_total * 100, 1)
        if prev_total > 0
        else None
    )

    yoy_change_pct = (
        round((current_total - yoy_total) / yoy_total * 100, 1)
        if yoy_total > 0
        else None
    )

    today = date.today()
    days_elapsed = today.day if (year == today.year and month == today.month) else last_day
    daily_average = round(current_total / days_elapsed) if days_elapsed > 0 else 0

    # 카테고리·시간대별 집계
    category_breakdown: dict[str, int] = {}
    timeslot_breakdown: dict[str, int] = {}
    for r in rows:
        cat = r.get("category") or "기타"
        slot = r.get("time_slot") or "기타"
        category_breakdown[cat] = category_breakdown.get(cat, 0) + r["amount"]
        timeslot_breakdown[slot] = timeslot_breakdown.get(slot, 0) + r["amount"]

    # 거래 건수 = 고유 receipt_id 수 (메뉴 항목 수가 아닌 영수증 단위)
    transaction_count = len({r["receipt_id"] for r in rows if r.get("receipt_id")}) or len(rows)

    # 날씨 상관 분석용 일별 합계
    daily_map: dict[str, int] = {}
    for r in rows:
        d = str(r["date"])[:10]
        daily_map[d] = daily_map.get(d, 0) + r["amount"]
    entries = [{"date": d, "amount": a} for d, a in daily_map.items()]

    return {
        "current_total": current_total,
        "prev_total": prev_total,
        "change_pct": change_pct,
        "yoy_total": yoy_total,
        "yoy_change_pct": yoy_change_pct,
        "transaction_count": transaction_count,
        "daily_average": daily_average,
        "category_breakdown": category_breakdown,
        "timeslot_breakdown": timeslot_breakdown,
        "entries": entries,
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


@router.put("/{sale_id}", response_model=SaleResponse)
async def update_sale(
    sale_id: str,
    body: SaleUpdate,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    existing = (
        supabase.table("sales")
        .select("id")
        .eq("id", sale_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="매출 데이터를 찾을 수 없습니다.")

    update_data = {k: v for k, v in body.model_dump(mode="json").items() if v is not None}
    result = supabase.table("sales").update(update_data).eq("id", sale_id).execute()
    return result.data[0]


@router.delete("/{sale_id}", status_code=204)
async def delete_sale(
    sale_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    existing = (
        supabase.table("sales")
        .select("id")
        .eq("id", sale_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="매출 데이터를 찾을 수 없습니다.")

    supabase.table("sales").delete().eq("id", sale_id).execute()
