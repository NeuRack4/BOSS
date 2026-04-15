"""
입지분석 API 라우터

GET  /location/districts          → 마포구 상권 목록
POST /location/analyze            → 상권 분석 (캐시 우선, TTL 7일)
GET  /location/history            → 창업자 검색 이력
GET  /location/features           → 행정동 피처 조회
GET  /location/ml-predictions     → 마포구 AI 매출 예측
POST /location/personal-analysis  → 개인화 상권 추천 + 매출 예측
GET  /location/personal-analysis/history → 개인화 분석 이력
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
    DistrictRecommendation,
    LocationSearchRecord,
    PersonalAnalysisRequest,
    PersonalAnalysisResponse,
    PersonalSessionRecord,
    RevenuePrediction,
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


@router.get("/features")
async def get_district_features(
    supabase: Client = Depends(db),
    gu: str | None = None,
    dong: str | None = None,
    limit: int = 50,
):
    """
    행정동 피처 테이블 조회 (district_features).
    ?gu=마포구  → 해당 구만 필터
    ?dong=서교동 → 해당 동만 필터
    """
    query = (
        supabase.table("district_features")
        .select(
            "dong_name, dong_code, gu_name, monthly_txn_count, daily_floating_pop, "
            "survival_rate, cafe_density, pop_age_20, pop_age_30, "
            "rent_per_sqm, pop_weekend, monthly_revenue_label, "
            "predicted_monthly_revenue, reference_period, updated_at"
        )
        .order("gu_name")
        .order("dong_name")
        .limit(min(limit, 500))
    )
    if gu:
        query = query.eq("gu_name", gu)
    if dong:
        query = query.ilike("dong_name", f"%{dong}%")

    result = query.execute()
    return result.data or []


# 마포구 상권 키워드 (상권_코드_명 기준)
_MAPO_KEYWORDS = [
    "홍대", "합정", "연남", "망원", "공덕", "마포", "서교", "상수",
    "성산", "아현", "신수", "용강", "대흥", "염리", "도화", "토정",
]


@router.get("/top20")
async def top20_predictions(
    seat_count: int,
    operating_hours: float,
    avg_price: int,
    operating_days: int,
    limit: int = 20,
    admin_gu: str | None = None,   # 서울 자치구 필터 (예: "마포구")
    supabase: Client = Depends(db),
):
    """
    개인 조건 기반 서울 전체(또는 특정 구) 상권 ML 매출 예측 Top N.
    monthly_revenue_label 있는 상권 전체 대상 bulk 추론 후 정렬 반환.
    admin_gu 지정 시 해당 구 상권만 반환.
    """
    from backend.core.constants import GU_KEYWORDS

    rows = (
        supabase.table("district_features")
        .select(
            "dong_name, gu_name, daily_floating_pop, pop_age_20, pop_age_30, "
            "pop_weekend, cafe_density, monthly_txn_count, rent_per_sqm, zone_label, zone_cluster"
        )
        .not_.is_("zone_label", "null")
        .limit(1000)
        .execute()
        .data or []
    )
    if not rows:
        raise HTTPException(status_code=503, detail="상권 피처 데이터 없음")

    # 구 필터 적용 — dong_name에 해당 구 키워드 포함 여부로 분류
    if admin_gu and admin_gu in GU_KEYWORDS:
        keywords = GU_KEYWORDS[admin_gu]
        rows = [r for r in rows if any(kw in (r.get("dong_name") or "") for kw in keywords)]
        if not rows:
            return []

    try:
        from backend.ml.predict import predict_bulk
        preds = predict_bulk(rows, seat_count, operating_hours, avg_price, operating_days)
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="ML 모델 미학습 — python -m backend.ml.train 실행 필요")

    ranked = sorted(
        [
            {
                "district": r["dong_name"],
                "area_type": r["gu_name"] or "",
                "zone_cluster": r.get("zone_cluster") or "",
                "predicted_monthly_revenue": p,
                "daily_floating_pop": r.get("daily_floating_pop"),
                "admin_gu": admin_gu or _detect_gu(r["dong_name"], GU_KEYWORDS),
            }
            for r, p in zip(rows, preds)
        ],
        key=lambda x: -x["predicted_monthly_revenue"],
    )
    for i, item in enumerate(ranked[: min(limit, 100)], 1):
        item["rank"] = i

    return ranked[: min(limit, 100)]


def _detect_gu(dong_name: str, gu_keywords: dict[str, list[str]]) -> str | None:
    """dong_name 키워드로 자치구 추정."""
    for gu, keywords in gu_keywords.items():
        if any(kw in dong_name for kw in keywords):
            return gu
    return None


@router.get("/predict")
async def predict_revenue(
    dong_name: str,
    seat_count: int,
    operating_hours: float,
    avg_price: int,
    operating_days: int,
    supabase: Client = Depends(db),
):
    """
    단일 상권 + 개인 조건 → ML 예측 월 매출 (실시간 추론용).
    personal-analysis 전체 플로우 없이 ML 결과만 빠르게 반환.
    """
    # monthly_revenue_label 있는 행 중 유동인구 가장 높은 상권 우선
    rows = (
        supabase.table("district_features")
        .select(
            "dong_name, daily_floating_pop, pop_age_20, pop_age_30, "
            "pop_weekend, cafe_density, monthly_txn_count, rent_per_sqm, zone_label"
        )
        .ilike("dong_name", f"%{dong_name}%")
        .not_.is_("zone_label", "null")
        .order("daily_floating_pop", desc=True)
        .limit(1)
        .execute()
        .data or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail=f"상권 없음: {dong_name}")

    try:
        from backend.ml.predict import predict_one
        predicted = predict_one(rows[0], seat_count, operating_hours, avg_price, operating_days)
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="ML 모델 미학습 — python -m backend.ml.train 실행 필요")

    return {
        "district": rows[0]["dong_name"],
        "predicted_monthly_revenue": predicted,
        "seat_count": seat_count,
        "operating_hours": operating_hours,
        "avg_price": avg_price,
        "operating_days": operating_days,
    }


@router.get("/seoul-stats")
async def seoul_stats(
    gu: str | None = None,   # 예: "마포구" — 없으면 서울 전체
    supabase: Client = Depends(db),
):
    """
    서울 상권 원시 데이터 통합 조회.
    reb_rent + sbiz_tradearea + district_features → 데이터 뷰어용.
    gu 파라미터로 자치구 필터링 (없으면 전체).
    """
    from backend.core.constants import GU_KEYWORDS

    # 1. 임대료 (최신 분기, gu 있으면 해당 구만)
    rent_query = (
        supabase.table("reb_rent")
        .select("gu_name, rent_per_sqm, quarter")
        .order("quarter", desc=True)
    )
    if gu:
        rent_query = rent_query.eq("gu_name", gu).limit(1)
    else:
        rent_query = rent_query.limit(25)  # 전체 구 최신 분기
    rent_rows = rent_query.execute().data or []

    # 2. 상권별 카페 매출 (sbiz_tradearea)
    sbiz_rows = (
        supabase.table("sbiz_tradearea")
        .select("dong_name, gu_name, monthly_revenue_avg, store_count, reference_month")
        .ilike("industry_name", "%커피%")
        .order("monthly_revenue_avg", desc=True)
        .limit(1000)
        .execute()
        .data or []
    )
    if gu and gu in GU_KEYWORDS:
        keywords = GU_KEYWORDS[gu]
        sbiz_rows = [r for r in sbiz_rows if any(kw in (r.get("dong_name") or "") for kw in keywords)]

    # 3. 유동인구 + 생존율 (district_features)
    feat_rows = (
        supabase.table("district_features")
        .select(
            "dong_name, daily_floating_pop, pop_age_20, pop_age_30, pop_weekend, "
            "monthly_txn_count, zone_cluster, survival_rate, new_stores_1y, closed_stores_1y"
        )
        .not_.is_("zone_label", "null")
        .order("daily_floating_pop", desc=True)
        .limit(1000)
        .execute()
        .data or []
    )
    if gu and gu in GU_KEYWORDS:
        keywords = GU_KEYWORDS[gu]
        feat_rows = [r for r in feat_rows if any(kw in (r.get("dong_name") or "") for kw in keywords)]

    return {
        "rent": rent_rows[0] if (gu and rent_rows) else None,
        "rent_all": rent_rows if not gu else [],
        "sbiz": sbiz_rows,
        "features": feat_rows,
        "gu": gu,
    }


@router.get("/ml-predictions")
async def get_ml_predictions(supabase: Client = Depends(db)):
    """
    마포구 상권 AI 예측 매출 조회.
    district_features에서 마포구 관련 상권명 키워드로 필터링.
    predicted_monthly_revenue 기준 내림차순 정렬.
    """
    rows = (
        supabase.table("district_features")
        .select(
            "dong_name, gu_name, monthly_txn_count, daily_floating_pop, "
            "monthly_revenue_label, predicted_monthly_revenue, reference_period"
        )
        .like("dong_code", "3%")           # 상권_코드 기반 레코드만 (행정동 코드 제외)
        .not_.is_("predicted_monthly_revenue", "null")
        .order("predicted_monthly_revenue", desc=True)
        .limit(500)
        .execute()
        .data or []
    )

    # 마포구 키워드 필터 (Python 단에서 OR 처리)
    filtered = [
        r for r in rows
        if any(kw in (r.get("dong_name") or "") for kw in _MAPO_KEYWORDS)
    ]

    return filtered


# ── 개인화 분석 헬퍼 ──────────────────────────────────────────────────────────

_CAFE_STAY_MIN = 90    # 카페 평균 체류시간 (분)
_OCCUPANCY     = 0.6   # 좌석 점유율
_STORE_SQM     = 30    # 임대료 추정 기준 면적 (㎡)


def _fetch_mapo_features(supabase: Client) -> list[dict]:
    """마포구 상권 피처 전체 조회 (상권_코드 기반)."""
    rows = (
        supabase.table("district_features")
        .select(
            "id, dong_name, dong_code, gu_name, monthly_txn_count, daily_floating_pop, "
            "pop_age_20, pop_age_30, pop_weekend, cafe_density, "
            "rent_per_sqm, monthly_revenue_label, predicted_monthly_revenue"
        )
        .like("dong_code", "3%")
        .limit(500)
        .execute()
        .data or []
    )
    return [
        r for r in rows
        if any(kw in (r.get("dong_name") or "") for kw in _MAPO_KEYWORDS)
    ]


def _score_district(
    row: dict,
    budget: int | None,
) -> tuple[float, list[str], int | None]:
    """
    상권 하나를 스코어링.
    반환: (score, reasons, monthly_rent_estimate_manwon)
    """
    score = 0.0
    reasons: list[str] = []

    # 1. 임대료 점수 (rent_per_sqm: 천원/㎡)
    rent = row.get("rent_per_sqm")
    monthly_rent_manwon = None
    if rent:
        monthly_rent_manwon = round(float(rent) * _STORE_SQM / 10)  # 만원 환산
        if budget:
            if monthly_rent_manwon <= budget:
                score += 30
                reasons.append(f"임대료 예산 내 ({monthly_rent_manwon}만원/월)")
            else:
                over = monthly_rent_manwon - budget
                score -= min(over / budget * 30, 30)
                reasons.append(f"임대료 예산 초과 ({monthly_rent_manwon}만원/월, +{over}만원)")
        else:
            score += 10
    else:
        score += 10  # 데이터 없음 → 중립

    # 2. 유동인구 점수
    pop = float(row.get("daily_floating_pop") or 0)
    if pop > 0:
        pts = min(pop / 50000 * 40, 40)
        score += pts
        reasons.append(f"일 유동인구 {int(pop):,}명")

    # 3. 상권 유형 — 유형 정보만 reason에 기록 (정렬은 엔드포인트에서 처리)
    area_type = row.get("gu_name", "")
    if area_type:
        reasons.append(f"{area_type}")

    # 4. AI 예측 매출 점수 (정규화: 15,000원/건 기준)
    pred = row.get("predicted_monthly_revenue")
    if pred:
        pts = min(float(pred) / 15000 * 10, 10)
        score += pts
        reasons.append(f"AI 예측 거래당 {int(pred):,}원")

    return round(score, 2), reasons, monthly_rent_manwon


def _calc_revenue(
    row: dict,
    seat_count: int,
    operating_hours: float,
    avg_price: int,
    operating_days: int,
) -> RevenuePrediction:
    """3-way 앙상블 매출 예측."""
    turns_per_hour = 60 / _CAFE_STAY_MIN
    daily_customers = seat_count * operating_hours * turns_per_hour * _OCCUPANCY
    monthly_txn = round(daily_customers * operating_days)

    # Method 1: 수식 기반 (객단가 × 추정 거래량)
    m1 = round(avg_price * monthly_txn)

    # Method 2: 상권 실데이터 × 추정 거래량
    actual_per_txn = row.get("monthly_revenue_label")
    m2 = round(float(actual_per_txn) * monthly_txn) if actual_per_txn else None

    # Method 3: ML 실시간 추론 (개인 조건 + 상권 피처 → 월 매출 직접 예측)
    m3: int | None = None
    try:
        from backend.ml.predict import predict_one
        m3 = predict_one(row, seat_count, operating_hours, avg_price, operating_days)
    except FileNotFoundError:
        pass  # 모델 미학습 시 Method 3 생략

    valid = [v for v in [m1, m2, m3] if v is not None]
    ensemble = round(sum(valid) / len(valid))

    return RevenuePrediction(
        top_district=row["dong_name"],
        method1_formula=m1,
        method2_area_data=m2,
        method3_ml_model=m3,
        ensemble=ensemble,
        monthly_transactions=monthly_txn,
    )


# ── 개인화 분석 엔드포인트 ────────────────────────────────────────────────────

@router.post("/personal-analysis", response_model=PersonalAnalysisResponse)
async def personal_analysis(
    body: PersonalAnalysisRequest,
    supabase: Client = Depends(db),
    x_user_id: str | None = Header(default=None),
):
    """
    사용자 조건 기반 상권 추천(A) + 매출 예측(B) 앙상블.
    결과를 location_analysis_sessions에 저장 후 반환.
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="x-user-id 헤더 필요")

    rows = _fetch_mapo_features(supabase)
    if not rows:
        raise HTTPException(status_code=502, detail="상권 피처 데이터 없음")

    # A: 상권 스코어링
    scored: list[tuple[float, dict, list[str], int | None]] = []
    for row in rows:
        score, reasons, rent_est = _score_district(
            row,
            body.budget_monthly_rent,
        )
        scored.append((score, row, reasons, rent_est))

    scored.sort(key=lambda x: -x[0])
    top5 = scored[:5]

    recommended = [
        DistrictRecommendation(
            district=row["dong_name"],
            area_type=row.get("gu_name") or "",
            score=score,
            reasons=reasons,
            monthly_rent_estimate=rent_est,
            predicted_revenue_per_txn=row.get("predicted_monthly_revenue"),
            actual_revenue_per_txn=row.get("monthly_revenue_label"),
        )
        for score, row, reasons, rent_est in top5
    ]

    # B: 매출 예측 (B 입력 있을 때만, 1위 상권 기준)
    revenue_pred: RevenuePrediction | None = None
    if all(v is not None for v in [body.seat_count, body.operating_hours, body.avg_price, body.operating_days]):
        top_row = top5[0][1]
        revenue_pred = _calc_revenue(
            top_row,
            body.seat_count,
            body.operating_hours,
            body.avg_price,
            body.operating_days,
        )

    # 세션 저장
    session_data = {
        "user_id": x_user_id,
        "budget_monthly_rent": body.budget_monthly_rent,
        "seat_count": body.seat_count,
        "operating_hours": body.operating_hours,
        "avg_price": body.avg_price,
        "operating_days": body.operating_days,
        "recommended_districts": [r.model_dump() for r in recommended],
        "revenue_prediction": revenue_pred.model_dump() if revenue_pred else None,
    }
    result = supabase.table("location_analysis_sessions").insert(session_data).execute()
    session_id = result.data[0]["id"]

    return PersonalAnalysisResponse(
        session_id=session_id,
        recommended_districts=recommended,
        revenue_prediction=revenue_pred,
    )


@router.get("/personal-analysis/history", response_model=list[PersonalSessionRecord])
async def personal_analysis_history(
    supabase: Client = Depends(db),
    x_user_id: str | None = Header(default=None),
):
    """개인화 분석 이력 (최신순 10건)."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="x-user-id 헤더 필요")

    result = (
        supabase.table("location_analysis_sessions")
        .select("*")
        .eq("user_id", x_user_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    return result.data or []
