from pydantic import BaseModel
from datetime import date as date_type, datetime
from typing import Literal

ExpenseCategory = Literal["rent", "ingredient", "labor", "utility", "other"]

CATEGORY_LABELS: dict[str, str] = {
    "rent":       "월세·임대료",
    "ingredient": "재료비",
    "labor":      "인건비",
    "utility":    "공과금",
    "other":      "기타",
}


class ExpenseCreate(BaseModel):
    date: date_type
    amount: int
    category: ExpenseCategory
    memo: str | None = None


class ExpenseResponse(BaseModel):
    id: str
    user_id: str
    date: date_type
    amount: int
    category: str
    memo: str | None
    created_at: datetime


class ExpenseUpdate(BaseModel):
    date: date_type | None = None
    amount: int | None = None
    category: ExpenseCategory | None = None
    memo: str | None = None
