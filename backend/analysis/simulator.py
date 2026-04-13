"""
마포구 카페 입지 시뮬레이션 엔진

입력: 골목상권 raw 데이터 + 서울 열린데이터 enriched 데이터
출력: 상권별 5개 지표 + 종합 스코어 + 위험도 등급
"""
from dataclasses import dataclass
from backend.core.constants import (
    MAPO_AVG_RENT,
    MAPO_AVG_FIXED_COST,
    MAPO_AVG_INITIAL_INVEST,
    CAFE_AVG_UNIT_PRICE,
    CAFE_CONVERSION_RATE,
    SCORE_WEIGHTS,
    RISK_HIGH_THRESHOLD,
    RISK_LOW_THRESHOLD,
)


@dataclass
class DistrictScores:
    district: str
    saturation_index: float      # 포화도 (낮을수록 좋음)
    estimated_monthly_revenue: int  # 예상 월매출 (원)
    bep_months: float            # 손익분기 개월 수 (짧을수록 좋음)
    survival_score: float        # 생존율 스코어 0~100
    growth_score: float          # 성장 잠재력 스코어 0~100
    total_score: float           # 종합 스코어 0~100
    risk_level: str              # LOW | MED | HIGH
    raw: dict                    # 원본 데이터


def simulate_districts(merged_data: list[dict]) -> list[DistrictScores]:
    """
    상권 목록에 대해 시뮬레이션 실행.

    merged_data 항목 필드:
      name, cafe_count, survival_rate, monthly_sales, foot_traffic (alley)
      daily_floating_pop, new_stores_1y, closed_stores_1y (seoul_open)
    """
    raw_scores = [_compute_raw(item) for item in merged_data]
    return _normalize_and_grade(raw_scores, merged_data)


def _compute_raw(item: dict) -> dict:
    foot_traffic = item.get("daily_floating_pop") or item.get("foot_traffic") or 1

    # 1. 포화도 지수: 카페 수 / 유동인구 1,000명당
    saturation = item.get("cafe_count", 0) / (foot_traffic / 1_000)

    # 2. 예상 월매출
    estimated_revenue = int(foot_traffic * CAFE_AVG_UNIT_PRICE * CAFE_CONVERSION_RATE * 30)

    # 3. BEP 개월 수
    monthly_profit = estimated_revenue - MAPO_AVG_RENT - MAPO_AVG_FIXED_COST
    bep_months = (
        MAPO_AVG_INITIAL_INVEST / monthly_profit
        if monthly_profit > 0
        else 999.0
    )

    # 4. 생존율 스코어 (0~100)
    survival_score = item.get("survival_rate", 0.0) * 100

    # 5. 성장 잠재력: (신규 - 폐업) / max(신규, 1) → -1~1 → 0~100 정규화
    new_s = item.get("new_stores_1y", 0)
    closed_s = item.get("closed_stores_1y", 0)
    growth_ratio = (new_s - closed_s) / max(new_s, 1)
    growth_score = max(0.0, min(100.0, (growth_ratio + 1) * 50))

    return {
        "district": item.get("name", ""),
        "saturation": saturation,
        "estimated_revenue": estimated_revenue,
        "bep_months": bep_months,
        "survival_score": survival_score,
        "growth_score": growth_score,
        "raw": item,
    }


def _normalize_and_grade(raw_scores: list[dict], merged_data: list[dict]) -> list[DistrictScores]:
    """역산 지표(포화도, BEP)를 포함해 0~100 정규화 후 가중 합산"""
    if not raw_scores:
        return []

    saturations = [r["saturation"] for r in raw_scores]
    bep_list = [min(r["bep_months"], 120) for r in raw_scores]  # 120개월 캡
    revenues = [r["estimated_revenue"] for r in raw_scores]

    results = []
    for r in raw_scores:
        # 포화도: 낮을수록 좋으므로 역산 정규화
        sat_norm = _invert_normalize(r["saturation"], saturations)
        # BEP: 짧을수록 좋으므로 역산 정규화
        bep_capped = min(r["bep_months"], 120)
        bep_norm = _invert_normalize(bep_capped, bep_list)
        # 매출: 높을수록 좋음
        rev_norm = _normalize(r["estimated_revenue"], revenues)

        total = (
            r["survival_score"] * SCORE_WEIGHTS["survival"]
            + sat_norm * SCORE_WEIGHTS["saturation"]
            + rev_norm * SCORE_WEIGHTS["revenue"]
            + bep_norm * SCORE_WEIGHTS["bep"]
            + r["growth_score"] * SCORE_WEIGHTS["growth"]
        )
        total = round(total, 1)

        if total >= RISK_LOW_THRESHOLD:
            risk = "LOW"
        elif total >= RISK_HIGH_THRESHOLD:
            risk = "MED"
        else:
            risk = "HIGH"

        results.append(DistrictScores(
            district=r["district"],
            saturation_index=round(r["saturation"], 3),
            estimated_monthly_revenue=r["estimated_revenue"],
            bep_months=round(r["bep_months"], 1),
            survival_score=round(r["survival_score"], 1),
            growth_score=round(r["growth_score"], 1),
            total_score=total,
            risk_level=risk,
            raw=r["raw"],
        ))

    results.sort(key=lambda x: x.total_score, reverse=True)
    return results


def _normalize(value: float, values: list[float]) -> float:
    mn, mx = min(values), max(values)
    if mx == mn:
        return 50.0
    return round((value - mn) / (mx - mn) * 100, 1)


def _invert_normalize(value: float, values: list[float]) -> float:
    mn, mx = min(values), max(values)
    if mx == mn:
        return 50.0
    return round((1 - (value - mn) / (mx - mn)) * 100, 1)


def to_json_scores(score: DistrictScores) -> dict:
    """DB 저장용 scores jsonb 변환"""
    return {
        "saturation_index": score.saturation_index,
        "estimated_monthly_revenue": score.estimated_monthly_revenue,
        "bep_months": score.bep_months,
        "survival_score": score.survival_score,
        "growth_score": score.growth_score,
        "total_score": score.total_score,
    }
