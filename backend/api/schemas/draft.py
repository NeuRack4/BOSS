from pydantic import BaseModel, Field
from datetime import datetime
from backend.core.constants import DraftType


class DraftResponse(BaseModel):
    id: int
    user_id: str
    type: DraftType
    storage_path: str
    metadata: dict
    created_at: datetime


class UserProfileInput(BaseModel):
    """온보딩 폼에서 수집한 창업자 프로파일"""
    name: str = Field(..., description="성명")
    birth_date: str = Field("", description="생년월일 (YYYY-MM-DD)")
    phone: str = Field("", description="연락처")
    email: str = Field("", description="이메일")
    resident_id_front: str = Field("", description="주민번호 앞 6자리")
    resident_id_gender: str = Field("", description="주민번호 성별 구분 1자리")
    business_type: str = Field("", description="업종 (cafe|bakery|snack)")
    business_name: str = Field("", description="상호명")
    district: str = Field("", description="서울 자치구")
    stage: str = Field("", description="창업 단계")
    open_date: str = Field("", description="개업 예정일")
    entity_type: str = Field("individual", description="사업자 유형")
    has_co_owner: bool = Field(False, description="공동사업자 여부")
    address: str = Field("", description="사업장 주소")
    address_detail: str = Field("", description="상세주소")
    floor_area: str = Field("", description="영업장 면적(㎡)")
    tax_type: str = Field("simplified", description="과세 유형")
    has_hygiene_edu: bool = Field(False, description="식품위생교육 이수 여부")


class GenerateDraftRequest(BaseModel):
    doc_type: str = Field(..., description="서류 유형 (business-registration 등)")
    user_profile: UserProfileInput


class GenerateDraftResponse(BaseModel):
    doc_type: str
    title: str
    content: str
    fields: dict = {}   # 구조화 필드 (표 렌더링용)
    disclaimer: str
