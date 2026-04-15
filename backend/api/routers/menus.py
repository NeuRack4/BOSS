"""
메뉴 관리 API
- 카페 메뉴 목록 CRUD
- OCR 매칭에서 menu_id 조회 시 활용
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Literal

from backend.api.dependencies import get_current_user_id
from backend.db.client import get_supabase

router = APIRouter()

MenuCategory = Literal["음료", "디저트", "기타"]


class MenuCreate(BaseModel):
    name: str
    category: MenuCategory
    price: int | None = None


class MenuUpdate(BaseModel):
    name: str | None = None
    category: MenuCategory | None = None
    price: int | None = None
    is_active: bool | None = None


@router.get("/")
def list_menus(
    user_id: str = Depends(get_current_user_id),
    include_inactive: bool = False,
):
    """카페 메뉴 목록 조회"""
    supabase = get_supabase()
    query = (
        supabase.table("menus")
        .select("*")
        .eq("user_id", user_id)
        .order("category")
        .order("name")
    )
    if not include_inactive:
        query = query.eq("is_active", True)
    return query.execute().data or []


@router.post("/", status_code=201)
def create_menu(
    body: MenuCreate,
    user_id: str = Depends(get_current_user_id),
):
    """메뉴 추가"""
    supabase = get_supabase()
    try:
        result = (
            supabase.table("menus")
            .insert({**body.model_dump(), "user_id": user_id})
            .execute()
        )
        return result.data[0]
    except Exception as e:
        msg = str(e)
        if "duplicate" in msg.lower() or "unique" in msg.lower():
            raise HTTPException(status_code=409, detail="이미 같은 이름의 메뉴가 있습니다.")
        raise HTTPException(status_code=500, detail=f"메뉴 저장 실패: {msg}")


@router.put("/{menu_id}")
def update_menu(
    menu_id: str,
    body: MenuUpdate,
    user_id: str = Depends(get_current_user_id),
):
    """메뉴 수정"""
    supabase = get_supabase()
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="수정할 내용이 없습니다.")

    result = (
        supabase.table("menus")
        .update(update_data)
        .eq("id", menu_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="메뉴를 찾을 수 없습니다.")
    return result.data[0]


@router.delete("/{menu_id}", status_code=204)
def delete_menu(
    menu_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """메뉴 삭제"""
    supabase = get_supabase()
    result = (
        supabase.table("menus")
        .delete()
        .eq("id", menu_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="메뉴를 찾을 수 없습니다.")
