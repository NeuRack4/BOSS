from pydantic import BaseModel, EmailStr
from datetime import datetime
from backend.core.constants import BusinessType, FounderStage, FounderSubStage


class FounderCreate(BaseModel):
    email: EmailStr
    business_type: BusinessType = BusinessType.CAFE
    region: str = "마포구"


class FounderProfileUpsert(BaseModel):
    """온보딩 폼 전체 데이터 — PUT /founders/me"""
    email: str = ""
    name: str = ""
    birth_date: str = ""
    phone: str = ""
    resident_id_front: str = ""
    resident_id_gender: str = ""
    business_type: str = ""
    business_name: str = ""
    district: str = ""
    stage: str = ""
    open_date: str = ""
    entity_type: str = "individual"
    has_co_owner: bool = False
    address: str = ""
    address_detail: str = ""
    floor_area: str = ""
    tax_type: str = "simplified"
    has_hygiene_edu: bool = False
    selected_documents: list[str] = []


class FounderStateUpdate(BaseModel):
    stage: FounderStage
    sub_stage: FounderSubStage
    metadata: dict = {}


class FounderResponse(BaseModel):
    id: str
    email: str
    business_type: str
    region: str
    created_at: datetime
    profile: dict = {}
