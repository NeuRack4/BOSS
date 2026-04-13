from pydantic import BaseModel
from datetime import date, datetime
from typing import Literal


SaleCategory = Literal["음료", "디저트", "기타"]
TimeSlot = Literal["오전", "오후", "저녁"]


class SaleCreate(BaseModel):
    date: date
    amount: int
    category: SaleCategory
    time_slot: TimeSlot
    memo: str | None = None


class SaleResponse(BaseModel):
    id: str
    user_id: str
    date: date
    amount: int
    category: str
    time_slot: str
    memo: str | None
    created_at: datetime


class SalesSummary(BaseModel):
    total_amount: int
    by_category: dict[str, int]   # {"음료": 120000, "디저트": 50000, ...}
    by_time_slot: dict[str, int]  # {"오전": 80000, "오후": 60000, ...}
    peak_time_slot: str | None    # 가장 매출 높은 시간대
    record_count: int
