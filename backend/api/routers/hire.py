"""
채용 관리 API 라우터
- GET  /hire/status          채용 현황 (창업자 상태 + 매출 요약)
- POST /hire/inference        AI 채용 타이밍 분석 (버튼 클릭 시)
- POST /hire/job-posting      채용공고 초안 생성 (3플랫폼)
- POST /hire/labor-contract   근로계약서 초안 생성
- GET  /hire/wage-simulation  인건비 시뮬레이션
"""
import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase import Client

from backend.api.dependencies import db, get_current_user_id
from backend.agents.hiring import (
    generate_job_posting_draft,
    generate_job_posting_visual,
    generate_labor_contract_draft,
    calc_total_labor_cost,
    MIN_WAGE_2025,
)
from backend.triggers.hiring_inference import run_hiring_inference_trigger

logger = logging.getLogger(__name__)

router = APIRouter()


# ── 요청/응답 스키마 ──────────────────────────────────────────────────────────

class JobPostingRequest(BaseModel):
    # 기본 근무 조건
    neighborhood: str = Field(default="마포구", description="근무 상권")
    weekly_hours: float = Field(default=20.0, ge=1, le=52, description="주 근무 시간")
    hourly_wage: int = Field(default=MIN_WAGE_2025, ge=MIN_WAGE_2025, description="시급 (최저임금 이상)")
    # 카페 정보 (DB 프리필 or 직접 입력)
    business_name: str = Field(default="", description="카페 상호명")
    address: str = Field(default="", description="근무지 주소")
    # 근무 일정
    work_days: list[str] = Field(default=[], description="근무 요일 (예: ['월','화','수'])")
    work_start: str = Field(default="", description="근무 시작 시간 (예: 09:00)")
    work_end: str = Field(default="", description="근무 종료 시간 (예: 14:00)")
    work_period: str = Field(default="", description="근무 기간 (예: 단기, 장기, 3개월, 협의)")
    # 모집 정보
    headcount: int = Field(default=1, ge=1, description="모집 인원")
    job_duties: list[str] = Field(default=[], description="주요 업무 목록")
    preferred: list[str] = Field(default=[], description="우대 조건 목록")
    # 복리후생 & 추가 안내
    benefits: list[str] = Field(default=[], description="복리후생 목록")
    extra_note: str = Field(default="", description="추가 안내 사항 (자유 입력)")


class JobPostingVisualRequest(JobPostingRequest):
    style_prompt: str = Field(default="", description="디자인 스타일 프롬프트 (예: 밝고 트렌디한 핑크 톤)")


class LaborContractRequest(BaseModel):
    weekly_hours: float = Field(default=20.0, ge=1, le=52, description="주 근무 시간")
    hourly_wage: int = Field(default=MIN_WAGE_2025, ge=MIN_WAGE_2025, description="시급")


class InferenceRequest(BaseModel):
    months_since_open: int = Field(default=0, ge=0, description="오픈 후 경과 개월 수")
    has_staff: bool = Field(default=False, description="현재 직원 유무")
    self_weekly_hours: int = Field(default=60, ge=0, le=168, description="창업자 본인 주간 근무 시간")
    menu_count: int = Field(default=5, ge=0, description="현재 메뉴 품목 수")
    neighborhood: str = Field(default="마포구", description="상권")


# ── 공통 헬퍼 ──────────────────────────────────────────────────────────────────

def _get_founder_profile(supabase: Client, user_id: str) -> dict:
    """창업자 프로파일 + 상태 조회"""
    profile_rows = (
        supabase.table("founder_business_info")
        .select("business_name, address")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    state_rows = (
        supabase.table("founder_state")
        .select("stage, sub_stage, updated_at")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    user_rows = (
        supabase.table("users")
        .select("region, created_at")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    profile = (profile_rows.data[0]) if profile_rows.data else {}
    state = (state_rows.data[0]) if state_rows.data else {}
    user = (user_rows.data[0]) if user_rows.data else {}

    # 계정 생성일 기준 경과 개월 (open_date 컬럼 없음)
    months_since_open = 0
    created_at = user.get("created_at")
    if created_at:
        try:
            from datetime import timezone
            ca = date.fromisoformat(str(created_at)[:10])
            months_since_open = (date.today() - ca).days // 30
        except (ValueError, TypeError):
            pass

    return {
        "business_name": profile.get("business_name", ""),
        "address": profile.get("address", ""),
        "stage": state.get("stage", ""),
        "sub_stage": state.get("sub_stage", ""),
        "district": user.get("region", "마포구"),
        "months_since_open": months_since_open,
        "employee_count": 0,
    }


def _get_recent_sales_summary(supabase: Client, user_id: str) -> dict | None:
    """최근 3개월 매출 요약 — 없으면 None 반환"""
    from_date = str(date.today() - timedelta(days=90))
    rows = (
        supabase.table("sales_items")
        .select("amount, date, time_slot")
        .eq("user_id", user_id)
        .gte("date", from_date)
        .execute()
        .data or []
    )
    if not rows:
        return None

    total = sum(r["amount"] for r in rows)
    by_slot: dict[str, int] = {}
    for r in rows:
        slot = r.get("time_slot") or "unknown"
        by_slot[slot] = by_slot.get(slot, 0) + r["amount"]

    peak_slot = max(by_slot, key=by_slot.get) if by_slot else None
    return {
        "recent_90d_revenue": total,
        "monthly_avg": total // 3,
        "peak_time_slot": peak_slot,
        "record_count": len(rows),
    }


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_hire_status(
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    """
    채용 현황 조회
    - 창업자 프로파일 + 현재 단계
    - 최근 3개월 매출 요약 (없으면 null)
    - 현재 계절 채용 신호 (개강/연말)
    """
    profile = _get_founder_profile(supabase, user_id)
    sales = _get_recent_sales_summary(supabase, user_id)

    today = date.today()
    season_signal = None
    if today.month == 2:
        season_signal = {"type": "개강시즌", "message": "3월 개강 D-30 — 홍대·연남동 유동인구 급증 대비"}
    elif today.month == 8:
        season_signal = {"type": "개강시즌", "message": "9월 개강 D-30 — 2학기 상권 회복 대비"}
    elif today.month == 11:
        season_signal = {"type": "연말성수기", "message": "12월 연말 D-45 — 마포구 카페 성수기 대비"}

    return {
        "profile": profile,
        "sales_summary": sales,
        "has_sales_data": sales is not None,
        "season_signal": season_signal,
        "min_wage_2025": MIN_WAGE_2025,
    }


@router.post("/inference")
async def run_inference(
    body: InferenceRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    AI 채용 타이밍 분석 (버튼 클릭 시 호출)
    LLM이 창업자 현황 + 매출 데이터를 분석하여 채용 권고 여부 판단.
    """
    context = {
        "months_since_open": body.months_since_open,
        "has_staff": body.has_staff,
        "self_weekly_hours": body.self_weekly_hours,
        "menu_count": body.menu_count,
        "neighborhood": body.neighborhood,
        "current_month": date.today().month,
    }
    result = await run_hiring_inference_trigger(user_id=user_id, context=context)
    return result


@router.post("/job-posting")
async def create_job_posting(
    body: JobPostingRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    채용공고 초안 생성 (당근마켓 / 알바천국 / 사람인)
    """

    class _Ctx:
        region = body.neighborhood

    extra = {
        "business_name": body.business_name,
        "address": body.address,
        "hourly_wage": body.hourly_wage,
        "weekly_hours": body.weekly_hours,
        "work_days": body.work_days,
        "work_start": body.work_start,
        "work_end": body.work_end,
        "work_period": body.work_period,
        "headcount": body.headcount,
        "job_duties": body.job_duties,
        "preferred": body.preferred,
        "benefits": body.benefits,
        "extra_note": body.extra_note,
    }

    try:
        result = await generate_job_posting_draft(_Ctx(), extra=extra)
        return result
    except Exception as e:
        logger.error("채용공고 초안 생성 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"초안 생성 실패: {e}")


@router.post("/job-posting-visual")
async def create_job_posting_visual(
    body: JobPostingVisualRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Claude Haiku로 채용공고 HTML 디자인 생성.
    프론트에서 html2pdf.js로 PDF 변환.
    """
    job_data = {
        "business_name": body.business_name,
        "address": body.address,
        "neighborhood": body.neighborhood,
        "hourly_wage": body.hourly_wage,
        "weekly_hours": body.weekly_hours,
        "work_days": body.work_days,
        "work_start": body.work_start,
        "work_end": body.work_end,
        "work_period": body.work_period,
        "headcount": body.headcount,
        "job_duties": body.job_duties,
        "preferred": body.preferred,
        "benefits": body.benefits,
        "extra_note": body.extra_note,
    }
    try:
        result = await generate_job_posting_visual(job_data, style_prompt=body.style_prompt)
        return result
    except Exception as e:
        logger.error("채용공고 HTML 생성 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"HTML 생성 실패: {e}")


@router.post("/labor-contract")
async def create_labor_contract(
    body: LaborContractRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    표준 근로계약서 초안 생성 (고용노동부 양식 기반)
    """

    class _Ctx:
        pass

    try:
        result = await generate_labor_contract_draft(_Ctx(), weekly_hours=body.weekly_hours)
        return result
    except Exception as e:
        logger.error("근로계약서 초안 생성 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"초안 생성 실패: {e}")


@router.get("/wage-simulation")
async def wage_simulation(
    weekly_hours: float = 20.0,
    hourly_wage: int = MIN_WAGE_2025,
    user_id: str = Depends(get_current_user_id),
):
    """인건비 시뮬레이션 (주휴수당 + 4대보험 의무 여부)"""
    if hourly_wage < MIN_WAGE_2025:
        raise HTTPException(status_code=400, detail=f"시급은 최저임금({MIN_WAGE_2025:,}원) 이상이어야 합니다.")
    return calc_total_labor_cost(hourly_wage, weekly_hours)
