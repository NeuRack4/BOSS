from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RiskClause(BaseModel):
    clause: str
    reason: str
    severity: str           # "High" | "Mid" | "Low"
    suggestion_from: str    # 수정 전 조항 텍스트
    suggestion_to: str      # 수정 후 조항 텍스트


class ReviewResult(BaseModel):
    summary: str
    gap_ratio: int   # 갑에게 유리한 정도 0~100
    eul_ratio: int   # 을에게 유리한 정도 0~100 (gap_ratio + eul_ratio = 100)
    risk_clauses: list[RiskClause]


class DocReviewCreate(BaseModel):
    title: str
    doc_type: str = "기타"      # "계약서" | "제안서" | "기타"
    user_role: str = "미지정"   # "갑(고용인/발주자)" | "을(피고용인/수주자)" | "직접입력" | "미지정"
    content: str                # 원문 텍스트 (파일에서 추출 or 붙여넣기)


class DocReviewResponse(BaseModel):
    id: str
    title: str
    doc_type: str
    user_role: str = "미지정"
    file_path: Optional[str] = None
    review_result: Optional[ReviewResult]
    created_at: datetime


class DocReviewListItem(BaseModel):
    id: str
    title: str
    doc_type: str
    user_role: str = "미지정"
    gap_ratio: Optional[int]
    eul_ratio: Optional[int]
    created_at: datetime
