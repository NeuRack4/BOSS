"""
입지분석 API 라우터

GET  /location/districts     → 마포구 상권 목록
POST /location/analyze       → 상권 분석 (캐시 우선, TTL 7일)
GET  /location/history       → 창업자 검색 이력
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from supabase import Client

from backend.agents.location import run as run_location_agent
from backend.api.dependencies import db
from backend.api.schemas.location import (
    AnalyzeRequest,
    AnalyzeResponse,
    DistrictListResponse,
    DistrictScore,
    LocationSearchRecord,
)
from backend.analysis.simulator import to_json_scores
from backend.agents.location import MAPO_DISTRICTS  # 상수 재사용

router = APIRouter()

_CACHE_TTL_DAYS = 7


@router.get("/districts", response_model=DistrictListResponse)
async def list_districts():
    """마포구 분석 가능 상권 목록 반환"""
    return {"districts": MAPO_DISTRICTS}


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    body: AnalyzeRequest,
    supabase: Client = Depends(db),
    x_user_id: str | None = Header(default=None),
):
    """
    상권 분석 실행.
    - 캐시(7일): location_reports에 저장된 결과 재사용
    - 캐시 미스: 에이전트 실행 → 결과 저장
    """
    requested = body.districts or MAPO_DISTRICTS
    cutoff = (datetime.now(timezone.utc) - timedelta(days=_CACHE_TTL_DAYS)).isoformat()

    # 캐시 조회
    cache_result = (
        supabase.table("location_reports")
        .select("*")
        .in_("district_name", requested)
        .gt("created_at", cutoff)
        .execute()
    )
    cached_rows = {row["district_name"]: row for row in (cache_result.data or [])}
    missing = [d for d in requested if d not in cached_rows]

    fresh_scores = []
    llm_report = ""
    top_pick = ""

    if missing:
        # 에이전트 실행 (누락 상권만)
        result = await run_location_agent(districts=missing)
        if "error" in result:
            raise HTTPException(status_code=502, detail=result["error"])

        llm_report = result["llm_report"]
        top_pick = result["top_pick"]

        # 결과 DB 저장 (upsert)
        for score_dict in result["scores"]:
            district = score_dict["district"]
            raw_item = next(
                (r for r in result["raw_data"] if r.get("name") == district), {}
            )
            supabase.table("location_reports").upsert(
                {
                    "district_name": district,
                    "scores": {k: v for k, v in score_dict.items() if k not in ("district", "risk_level")},
                    "risk_level": score_dict["risk_level"],
                    "llm_report": llm_report,
                    "raw_data": raw_item,
                },
                on_conflict="district_name",
            ).execute()
            fresh_scores.append(score_dict)

    # 캐시 + 신규 결과 통합
    all_scores: list[DistrictScore] = []
    for d in requested:
        if d in cached_rows:
            row = cached_rows[d]
            s = row["scores"]
            all_scores.append(DistrictScore(
                district=row["district_name"],
                saturation_index=s["saturation_index"],
                estimated_monthly_revenue=s["estimated_monthly_revenue"],
                bep_months=s["bep_months"],
                survival_score=s["survival_score"],
                growth_score=s["growth_score"],
                total_score=s["total_score"],
                risk_level=row["risk_level"],
            ))
            if not llm_report:
                llm_report = row.get("llm_report", "")
        else:
            fresh = next((f for f in fresh_scores if f["district"] == d), None)
            if fresh:
                all_scores.append(DistrictScore(**fresh))

    all_scores.sort(key=lambda x: x.total_score, reverse=True)
    if not top_pick and all_scores:
        top_pick = all_scores[0].district

    # 검색 이력 저장 (user_id 있을 때만)
    if x_user_id:
        report_ids = [
            cached_rows[d]["id"] for d in requested if d in cached_rows
        ]
        supabase.table("founder_location_searches").insert({
            "user_id": x_user_id,
            "districts": requested,
            "top_pick": top_pick,
            "report_ids": report_ids,
        }).execute()

    return AnalyzeResponse(
        top_pick=top_pick,
        scores=all_scores,
        llm_report=llm_report,
        cached=len(missing) == 0,
        analyzed_at=datetime.now(timezone.utc),
    )


@router.get("/history", response_model=list[LocationSearchRecord])
async def get_history(
    supabase: Client = Depends(db),
    x_user_id: str | None = Header(default=None),
):
    """입지 검색 이력 반환 (최신순 10건). user_id 없으면 전체 최근 이력."""
    query = (
        supabase.table("founder_location_searches")
        .select("id, districts, top_pick, searched_at")
        .order("searched_at", desc=True)
        .limit(10)
    )
    if x_user_id:
        query = query.eq("user_id", x_user_id)
    result = query.execute()
    return result.data or []
