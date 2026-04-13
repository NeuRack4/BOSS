from pydantic import BaseModel
from datetime import datetime


class AnalyzeRequest(BaseModel):
    districts: list[str] | None = None  # None이면 마포구 전체


class DistrictScore(BaseModel):
    district: str
    saturation_index: float
    estimated_monthly_revenue: int
    bep_months: float
    survival_score: float
    growth_score: float
    total_score: float
    risk_level: str  # LOW | MED | HIGH


class AnalyzeResponse(BaseModel):
    top_pick: str
    scores: list[DistrictScore]
    llm_report: str
    cached: bool
    analyzed_at: datetime


class DistrictListResponse(BaseModel):
    districts: list[str]


class LocationSearchRecord(BaseModel):
    id: int
    districts: list[str]
    top_pick: str | None
    searched_at: datetime
