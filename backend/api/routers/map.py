"""
마포구 상권 지도 API
- dong 단위 개별 마커 (sbiz_tradearea 실데이터)
- Leaflet 지도 오버레이용
"""
from fastapi import APIRouter
from backend.db.client import get_supabase

router = APIRouter()

# sbiz_tradearea dong_name → 실제 좌표 (위도·경도)
DONG_COORDS: dict[str, tuple[float, float]] = {
    # ── 홍대 클러스터 ──────────────────────────────
    "홍대입구역(홍대)":         (37.5572, 126.9243),
    "홍대입구역 3번":           (37.5565, 126.9248),
    "상수역(홍대)":             (37.5485, 126.9228),
    "서교동(홍대)":             (37.5526, 126.9226),
    "홍대 걷고싶은 거리":       (37.5530, 126.9220),
    "홍대땡땡거리":             (37.5519, 126.9257),
    "홍대소상공인상점가":       (37.5538, 126.9219),
    "홍대부속여중고앞":         (37.5558, 126.9212),
    "홍대부중":                 (37.5549, 126.9237),
    # ── 합정 ──────────────────────────────────────
    "합정역":                   (37.5496, 126.9143),
    "합정역 8번":               (37.5490, 126.9152),
    # ── 연남동 ────────────────────────────────────
    "연남동(홍대)":             (37.5617, 126.9256),
    "연트럴파크(연남동주민센터)":(37.5626, 126.9271),
    # ── 망원동 ────────────────────────────────────
    "망원역":                   (37.5557, 126.9075),
    "망원역 1번":               (37.5547, 126.9071),
    "망원시장":                 (37.5540, 126.9088),
    "KB국민은행 망원동지점":    (37.5546, 126.9082),
    "망원월드컵시장":           (37.5532, 126.9097),
    # ── 마포구청·성산 ─────────────────────────────
    "마포구청역 1번":           (37.5608, 126.9098),
    "마포구청역 4번":           (37.5602, 126.9093),
    "마포구청역 7번":           (37.5601, 126.9105),
    "성산중학교":               (37.5659, 126.9181),
    # ── 공덕 ──────────────────────────────────────
    "공덕역(공덕오거리)":       (37.5426, 126.9525),
    "공덕시장":                 (37.5432, 126.9512),
    "공덕동주민센터":           (37.5440, 126.9518),
    # ── 마포역 ────────────────────────────────────
    "마포역":                   (37.5391, 126.9498),
    "마포역 4번":               (37.5388, 126.9503),
    "마포FM":                   (37.5395, 126.9508),
    "마포농수산물시장":         (37.5380, 126.9504),
    # ── 아현동 ────────────────────────────────────
    "아현역 2번":               (37.5508, 126.9607),
    "아현가구거리상점가":       (37.5477, 126.9600),
    # ── 신수동 ────────────────────────────────────
    "신수동주민센터":           (37.5446, 126.9384),
}

# 상권 그룹 레이블 (마커 툴팁용)
AREA_NAME_TO_ID: dict[str, str] = {
    "홍대입구": "hongdae", "합정": "hapjeong", "연남동": "yeonnam",
    "망원동": "mangwon", "성산·구청": "seongsan", "공덕": "gongdeok",
    "마포대로": "mapo", "아현동": "ahyeon", "신수동": "sinsu",
}

DONG_AREA: dict[str, str] = {
    **{k: "홍대입구" for k in ["홍대입구역(홍대)", "홍대입구역 3번", "상수역(홍대)", "서교동(홍대)",
                               "홍대 걷고싶은 거리", "홍대땡땡거리", "홍대소상공인상점가",
                               "홍대부속여중고앞", "홍대부중"]},
    **{k: "합정"    for k in ["합정역", "합정역 8번"]},
    **{k: "연남동"  for k in ["연남동(홍대)", "연트럴파크(연남동주민센터)"]},
    **{k: "망원동"  for k in ["망원역", "망원역 1번", "망원시장", "KB국민은행 망원동지점", "망원월드컵시장"]},
    **{k: "성산·구청" for k in ["마포구청역 1번", "마포구청역 4번", "마포구청역 7번", "성산중학교"]},
    **{k: "공덕"    for k in ["공덕역(공덕오거리)", "공덕시장", "공덕동주민센터"]},
    **{k: "마포대로" for k in ["마포역", "마포역 4번", "마포FM", "마포농수산물시장"]},
    **{k: "아현동"  for k in ["아현역 2번", "아현가구거리상점가"]},
    **{k: "신수동"  for k in ["신수동주민센터"]},
}

# reb_rent → area 매핑 (실데이터 4개 상권)
RENT_AREA_MAP: dict[str, list[str]] = {
    "홍대/합정": ["홍대입구", "합정"],
    "동교/연남": ["연남동"],
    "망원역":    ["망원동"],
    "공덕역":    ["공덕"],
}

# 실데이터 없는 상권 추정치 (만원/월, 카페 평균 30m²)
RENT_FALLBACK: dict[str, int] = {
    "성산·구청": 110,
    "마포대로":  120,
    "아현동":    90,
    "신수동":    85,
}


@router.get("/overview")
def get_overview():
    """
    dong 단위 개별 마커 데이터 반환
    - 매출·유동인구: sbiz_tradearea 실데이터 (2024년 3·4분기)
    - 월세: reb_rent 실데이터 4개 상권 + 나머지 추정치 (카페 평균 30m² 기준)
    """
    supabase = get_supabase()

    # 매출·유동인구
    trade_rows = (
        supabase.table("sbiz_tradearea")
        .select("dong_name, monthly_revenue_avg, store_count, reference_month")
        .in_("reference_month", ["20243", "20244"])
        .in_("dong_name", list(DONG_COORDS.keys()))
        .execute()
        .data or []
    )
    agg: dict[str, dict] = {}
    for r in trade_rows:
        name = r["dong_name"]
        if name not in agg:
            agg[name] = {"revenue": 0.0, "traffic": 0, "cnt": 0}
        agg[name]["revenue"] += float(r["monthly_revenue_avg"] or 0)
        agg[name]["traffic"] += int(r["store_count"] or 0)
        agg[name]["cnt"] += 1

    # 월세 실데이터 — reb_rent (단위: 천원/m²), 카페 평균 30m² 기준
    rent_rows = (
        supabase.table("reb_rent")
        .select("gu_name, rent_per_sqm")
        .in_("gu_name", list(RENT_AREA_MAP.keys()))
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

    # area → 월세(만원/월) 계산
    area_rent: dict[str, int] = {}
    for reb_key, areas in RENT_AREA_MAP.items():
        if reb_key in rent_agg:
            avg_per_sqm = rent_agg[reb_key]["total"] / rent_agg[reb_key]["cnt"]
            rent_man = round(avg_per_sqm * 30 / 10)  # 천원/m² × 30m² → 만원
            for a in areas:
                area_rent[a] = rent_man
    area_rent.update(RENT_FALLBACK)

    result = []
    for dong, (lat, lng) in DONG_COORDS.items():
        d = agg.get(dong)
        area = DONG_AREA.get(dong, "기타")
        rent = area_rent.get(area, 100)
        result.append({
            "id":              dong,
            "name":            dong,
            "area":            area,
            "area_id":         AREA_NAME_TO_ID.get(area, ""),
            "lat":             lat,
            "lng":             lng,
            "monthly_revenue": int(d["revenue"] / d["cnt"]) if d else 0,
            "foot_traffic":    d["traffic"] // d["cnt"] if d else 0,
            "rent_estimate":   rent,
            "rent_is_real":    area in area_rent and area not in RENT_FALLBACK,
        })

    return result
