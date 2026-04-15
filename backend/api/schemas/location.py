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


# ── 개인화 분석 ──────────────────────────────────────────────────────────────

class PersonalAnalysisRequest(BaseModel):
    # A: 상권 추천
    budget_monthly_rent: int | None = None    # 월 임대료 예산 (만원)
    # B: 매출 예측
    seat_count: int | None = None             # 좌석 수
    operating_hours: float | None = None      # 일 영업시간
    avg_price: int | None = None              # 객단가 (원)
    operating_days: int | None = None         # 월 영업일


class DistrictRecommendation(BaseModel):
    district: str
    area_type: str
    score: float
    reasons: list[str]
    monthly_rent_estimate: int | None         # 30㎡ 기준 추정 임대료 (만원)
    predicted_revenue_per_txn: int | None     # ML 예측 거래당 매출
    actual_revenue_per_txn: int | None        # 실데이터 거래당 매출


class RevenuePrediction(BaseModel):
    top_district: str
    method1_formula: int        # 수식 기반
    method2_area_data: int | None  # 상권 실데이터 기반
    method3_ml_model: int | None   # ML 모델 기반
    ensemble: int               # 3개 평균
    monthly_transactions: int   # 추정 월 거래건수


class PersonalAnalysisResponse(BaseModel):
    session_id: int
    recommended_districts: list[DistrictRecommendation]
    revenue_prediction: RevenuePrediction | None


class PersonalSessionRecord(BaseModel):
    id: int
    budget_monthly_rent: int | None
    seat_count: int | None
    operating_hours: float | None
    avg_price: int | None
    operating_days: int | None
    recommended_districts: list | None
    revenue_prediction: dict | None
    created_at: datetime
