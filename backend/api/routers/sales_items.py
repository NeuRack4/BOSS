"""
메뉴별 매출 세분화 API
- sales_items 테이블: 영수증 1장 = 메뉴별 여러 행
- 메뉴별 집계: 판매량·매출액 랭킹
"""
import calendar
import uuid
from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Literal

from backend.api.dependencies import get_current_user_id
from backend.db.client import get_supabase

router = APIRouter()


class SaleItemCreate(BaseModel):
    menu_id: str | None = None
    menu_name: str
    category: str = "기타"
    date: date_type
    quantity: int = 1
    unit_price: int
    amount: int
    time_slot: Literal["09:00-11:30","11:30-14:00","14:00-16:30","16:30-19:00","19:00-21:30"] = "09:00-11:30"
    source: Literal["manual", "ocr"] = "manual"


class SaleItemsBulkCreate(BaseModel):
    """영수증 한 장 → 여러 항목 일괄 저장"""
    items: list[SaleItemCreate]


def _normalize(s: str) -> str:
    """공백·특수공백 제거 + 소문자 변환 (카페라떼 == 카페 라떼)"""
    return s.strip().lower().replace(" ", "").replace("\u00a0", "").replace("\u3000", "")


def _match_menu(menu_name: str, menus: list[dict]) -> str | None:
    """메뉴명 매칭 (공백 무시 완전일치 → 공백 무시 부분일치)"""
    norm = _normalize(menu_name)
    for m in menus:
        if _normalize(m["name"]) == norm:
            return m["id"]
    for m in menus:
        mn = _normalize(m["name"])
        if norm in mn or mn in norm:
            return m["id"]
    return None


@router.post("/bulk", status_code=201)
def create_bulk(
    body: SaleItemsBulkCreate,
    user_id: str = Depends(get_current_user_id),
):
    """영수증 확인 후 메뉴별 항목 일괄 저장"""
    supabase = get_supabase()
    if not body.items:
        raise HTTPException(status_code=400, detail="저장할 항목이 없습니다.")

    # 메뉴 목록 로드 (menu_id 없는 항목 자동 매칭)
    menus = (
        supabase.table("menus")
        .select("id, name")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data or []
    )

    # menu_id → category 룩업맵
    menu_cat_map = {m["id"]: m.get("category", "기타") for m in menus}

    receipt_id = str(uuid.uuid4())
    rows = []
    for item in body.items:
        menu_id = item.menu_id or _match_menu(item.menu_name, menus)
        category = item.category if item.category != "기타" else menu_cat_map.get(menu_id or "", "기타")
        rows.append({
            "user_id": user_id,
            "menu_id": menu_id,
            "menu_name": item.menu_name,
            "category": category,
            "date": str(item.date),
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "amount": item.amount,
            "time_slot": item.time_slot,
            "source": item.source,
            "receipt_id": receipt_id,
        })

    result = supabase.table("sales_items").insert(rows).execute()
    return {"saved": len(result.data), "items": result.data}


@router.get("/")
def list_sales_items(
    from_date: date_type | None = Query(None),
    to_date: date_type | None = Query(None),
    user_id: str = Depends(get_current_user_id),
):
    """메뉴별 판매 내역 조회"""
    supabase = get_supabase()
    query = (
        supabase.table("sales_items")
        .select("*")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .order("created_at", desc=True)
        .limit(200)
    )
    if from_date:
        query = query.gte("date", str(from_date))
    if to_date:
        query = query.lte("date", str(to_date))
    return query.execute().data or []


@router.get("/summary")
def get_menu_summary(
    year: int = Query(...),
    month: int = Query(...),
    user_id: str = Depends(get_current_user_id),
):
    """월별 메뉴 판매 집계 — 메뉴별 판매량·매출액 랭킹"""
    supabase = get_supabase()
    _, last_day = calendar.monthrange(year, month)
    from_date = date_type(year, month, 1)
    to_date = date_type(year, month, last_day)

    rows = (
        supabase.table("sales_items")
        .select("menu_name, menu_id, category, quantity, amount, date, time_slot")
        .eq("user_id", user_id)
        .gte("date", str(from_date))
        .lte("date", str(to_date))
        .execute()
        .data or []
    )

    if not rows:
        return {
            "year": year, "month": month,
            "total_amount": 0, "total_quantity": 0,
            "menu_ranking": [], "category_breakdown": {},
            "daily_totals": {}, "timeslot_totals": {},
        }

    menu_agg: dict[str, dict] = {}
    category_agg: dict[str, int] = {}
    daily: dict[str, int] = {}
    slot: dict[str, int] = {}

    for r in rows:
        name = r["menu_name"]
        if name not in menu_agg:
            menu_agg[name] = {
                "menu_name": name, "menu_id": r.get("menu_id"),
                "category": r.get("category", "기타"),
                "quantity": 0, "amount": 0,
            }
        menu_agg[name]["quantity"] += r["quantity"]
        menu_agg[name]["amount"]   += r["amount"]

        cat = r.get("category") or "기타"
        category_agg[cat] = category_agg.get(cat, 0) + r["amount"]

        d = str(r["date"])[:10]
        daily[d] = daily.get(d, 0) + r["amount"]

        ts = r.get("time_slot") or "기타"
        slot[ts] = slot.get(ts, 0) + r["amount"]

    ranking = sorted(menu_agg.values(), key=lambda x: x["amount"], reverse=True)

    return {
        "year": year, "month": month,
        "total_amount": sum(r["amount"] for r in rows),
        "total_quantity": sum(r["quantity"] for r in rows),
        "menu_ranking": ranking,
        "category_breakdown": category_agg,
        "daily_totals": dict(sorted(daily.items())),
        "timeslot_totals": slot,
    }


@router.delete("/{item_id}", status_code=204)
def delete_sales_item(
    item_id: str,
    user_id: str = Depends(get_current_user_id),
):
    supabase = get_supabase()
    result = (
        supabase.table("sales_items")
        .delete()
        .eq("id", item_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
