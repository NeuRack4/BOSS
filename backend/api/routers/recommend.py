"""
창업 준비자 상권 추천 API
- 보유 자본 기반 진입 가능 상권 필터링
- 매출·유동인구·생존율·월세 종합 점수 산출
- 정부 지원사업 자동 매칭
"""
from fastapi import APIRouter, Query
from backend.db.client import get_supabase

router = APIRouter()

# sbiz_tradearea 대표 dong (상권별 주요 지점)
AREA_REPRESENTATIVE_DONG = {
    "hongdae":  "홍대입구역(홍대)",
    "hapjeong": "합정역",
    "yeonnam":  "연남동(홍대)",
    "mangwon":  "망원역",
    "gongdeok": "공덕역(공덕오거리)",
    "seongsan": "성산중학교",
    "mapo":     "마포역",
    "ahyeon":   "아현역 2번",
    "sinsu":    "신수동주민센터",
}

RENT_MAP = {
    "hongdae": "홍대/합정", "hapjeong": "홍대/합정",
    "yeonnam": "동교/연남",
    "mangwon": "망원역",
    "gongdeok": "공덕역",
}


def _rank_normalize(values: list[float]) -> list[float]:
    """0~1 정규화"""
    mn, mx = min(values), max(values)
    if mx == mn:
        return [0.5] * len(values)
    return [(v - mn) / (mx - mn) for v in values]


@router.get("/areas")
def recommend_areas(
    capital: int = Query(..., ge=1, le=1_000_000, description="보유 자본 (만원, 1~1,000,000)"),
    age: int = Query(None, ge=1, le=120, description="나이 (1~120세)"),
):
    """
    보유 자본 기반 상권 추천
    - 창업 비용 <= 보유 자본 * 0.85 (여유 자금 15% 확보)
    - 종합 점수: 매출(35%) + 생존율(30%) + 유동인구(20%) + 월세부담(15%)
    """
    supabase = get_supabase()

    # 창업 비용 데이터
    costs = (
        supabase.table("area_startup_cost")
        .select("*")
        .execute()
        .data or []
    )
    cost_map = {c["area_id"]: c for c in costs}

    # sbiz_tradearea 매출·유동인구 (최신 2분기 평균)
    dong_list = list(AREA_REPRESENTATIVE_DONG.values())
    trade_rows = (
        supabase.table("sbiz_tradearea")
        .select("dong_name, monthly_revenue_avg, store_count, reference_month")
        .in_("reference_month", ["20243", "20244"])
        .in_("dong_name", dong_list)
        .execute()
        .data or []
    )
    trade_agg: dict[str, dict] = {}
    for r in trade_rows:
        name = r["dong_name"]
        if name not in trade_agg:
            trade_agg[name] = {"revenue": 0.0, "traffic": 0, "cnt": 0}
        trade_agg[name]["revenue"] += float(r["monthly_revenue_avg"] or 0)
        trade_agg[name]["traffic"] += int(r["store_count"] or 0)
        trade_agg[name]["cnt"] += 1

    # 월세 실데이터
    rent_rows = (
        supabase.table("reb_rent")
        .select("gu_name, rent_per_sqm")
        .in_("gu_name", list(set(RENT_MAP.values())))
        .in_("quarter", ["20243", "20244"])
        .execute()
        .data or []
    )
    rent_agg: dict[str, dict] = {}
    for r in rent_rows:
        g = r["gu_name"]
        if g not in rent_agg:
            rent_agg[g] = {"total": 0.0, "cnt": 0}
        rent_agg[g]["total"] += float(r["rent_per_sqm"] or 0)
        rent_agg[g]["cnt"] += 1

    rent_by_area: dict[str, int] = {}
    for area_id, reb_key in RENT_MAP.items():
        if reb_key in rent_agg:
            avg = rent_agg[reb_key]["total"] / rent_agg[reb_key]["cnt"]
            rent_by_area[area_id] = round(avg * 30 / 10)  # 천원/m² × 30m² → 만원
    # fallback
    for area_id, fallback in {"seongsan": 110, "mapo": 120, "ahyeon": 90, "sinsu": 85}.items():
        rent_by_area.setdefault(area_id, fallback)

    # 자본 기준 필터 + 데이터 조합
    budget_limit = capital * 0.85
    candidates = []
    for area_id, cost in cost_map.items():
        if cost["min_total"] > budget_limit:
            continue  # 최소 비용도 감당 불가

        dong = AREA_REPRESENTATIVE_DONG.get(area_id)
        td = trade_agg.get(dong, {})
        revenue = int(td["revenue"] / td["cnt"]) if td.get("cnt") else 0
        traffic = td["traffic"] // td["cnt"] if td.get("cnt") else 0
        rent = rent_by_area.get(area_id, 120)

        candidates.append({
            "area_id":       area_id,
            "area_name":     cost["area_name"],
            "avg_deposit":   cost["avg_deposit"],
            "avg_interior":  cost["avg_interior"],
            "avg_equipment": cost["avg_equipment"],
            "avg_total":     cost["avg_total"],
            "min_total":     cost["min_total"],
            "survival_rate": float(cost["survival_rate"] or 0),
            "monthly_revenue": revenue,
            "foot_traffic":  traffic,
            "rent_monthly":  rent,
            "affordable":    cost["avg_total"] <= budget_limit,
        })

    if not candidates:
        return {"capital": capital, "results": [], "message": "보유 자본으로 진입 가능한 상권이 없습니다."}

    # 점수 계산 (정규화)
    revenues = [c["monthly_revenue"] for c in candidates]
    survivals = [c["survival_rate"] for c in candidates]
    traffics  = [c["foot_traffic"]   for c in candidates]
    rents     = [c["rent_monthly"]   for c in candidates]

    rev_n  = _rank_normalize(revenues)
    sur_n  = _rank_normalize(survivals)
    trf_n  = _rank_normalize(traffics)
    rent_n = _rank_normalize(rents)

    for i, c in enumerate(candidates):
        c["score"] = (
            rev_n[i]         * 0.35 +
            sur_n[i]         * 0.30 +
            trf_n[i]         * 0.20 +
            (1 - rent_n[i])  * 0.15   # 월세 낮을수록 유리
        )

    results = sorted(candidates, key=lambda x: x["score"], reverse=True)

    # 청년 여부
    is_youth = age is not None and age <= 39

    return {
        "capital":   capital,
        "is_youth":  is_youth,
        "results":   results,
    }


@router.get("/subsidies")
async def recommend_subsidies(
    capital: int = Query(..., ge=1, le=1_000_000),
    age: int = Query(None, ge=1, le=120),
):
    """추천 상권에 맞는 지원사업 매칭"""
    from backend.db.client import get_supabase as _get
    sb = _get()

    query = "마포구 카페 창업 지원사업"
    if age and age <= 39:
        query += " 청년창업"
    if capital < 5000:
        query += " 소자본"

    # search_subsidies RPC 호출
    results = sb.rpc("search_subsidies", {
        "query_text": query,
        "match_count": 5,
    }).execute().data or []

    return {"query": query, "results": results}
