from pydantic import BaseModel, EmailStr
from datetime import datetime
from backend.core.constants import BusinessType, FounderStage, FounderSubStage


class FounderCreate(BaseModel):
    email: EmailStr
    # 마포구 카페 전용 — 하드코딩 기본값
    business_type: BusinessType = BusinessType.CAFE
    region: str = "마포구"


class FounderStateUpdate(BaseModel):
    stage: FounderStage
    sub_stage: FounderSubStage
    metadata: dict = {}


class FounderResponse(BaseModel):
    id: str
    email: str
    business_type: str
    region: str
    stage: str
    created_at: datetime
