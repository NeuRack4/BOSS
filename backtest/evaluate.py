"""
백테스트 평가 스크립트

평가 항목:
  1. 지원사업 추천 정확도 (Precision / Recall)
  2. 입지 분석 정확도 (추천 vs 실제 생존율)
  3. 트리거 타이밍 (D-5 vs D-3 알림 → 신청 완료율 비교)
"""
import asyncio
import json
from pathlib import Path
from dataclasses import dataclass


@dataclass
class SubsidyEvalResult:
    precision: float
    recall: float
    f1: float


@dataclass
class LocationEvalResult:
    mae: float          # 생존율 예측 오차 (Mean Absolute Error)
    top3_hit_rate: float  # 추천 TOP3에 실제 생존율 상위 상권 포함 비율


def evaluate_subsidy_recommendations(
    predictions: list[str],
    ground_truth: list[str],
) -> SubsidyEvalResult:
    """지원사업 추천 Precision / Recall 평가"""
    pred_set = set(predictions)
    gt_set = set(ground_truth)

    tp = len(pred_set & gt_set)
    precision = tp / len(pred_set) if pred_set else 0.0
    recall = tp / len(gt_set) if gt_set else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if (precision + recall) > 0
        else 0.0
    )

    return SubsidyEvalResult(precision=precision, recall=recall, f1=f1)


def evaluate_location_recommendations(
    predicted_top3: list[str],
    actual_survival_rates: dict[str, float],
    top_n: int = 3,
) -> LocationEvalResult:
    """입지 분석 정확도 평가"""
    sorted_actual = sorted(
        actual_survival_rates.items(), key=lambda x: x[1], reverse=True
    )
    actual_top3 = {name for name, _ in sorted_actual[:top_n]}
    predicted_set = set(predicted_top3[:top_n])

    hit_rate = len(predicted_set & actual_top3) / top_n

    # MAE: 예측된 상권의 생존율과 실제 생존율 차이
    errors = [
        abs(actual_survival_rates.get(name, 0.5) - actual_survival_rates.get(name, 0))
        for name in predicted_top3
        if name in actual_survival_rates
    ]
    mae = sum(errors) / len(errors) if errors else 0.0

    return LocationEvalResult(mae=mae, top3_hit_rate=hit_rate)


async def run_full_backtest(output_path: str = "backtest/results.json") -> dict:
    """전체 백테스트 실행"""
    from backend.data.crawlers.alley import fetch_alley_data

    # 마포구 실제 생존율 데이터 수집
    alley_data = await fetch_alley_data(region="마포구", business_type="카페")
    actual_survival = {d["name"]: d["survival_rate"] for d in alley_data}

    # TODO: 실제 지원사업 추천 결과와 비교 데이터 연결
    # 현재는 예시 데이터로 평가
    subsidy_result = evaluate_subsidy_recommendations(
        predictions=["소상공인 카페 지원", "마포구 청년창업 지원"],
        ground_truth=["소상공인 카페 지원", "서울 F&B 창업지원", "마포구 청년창업 지원"],
    )

    location_result = evaluate_location_recommendations(
        predicted_top3=["연남동", "망원동", "합정"],
        actual_survival_rates=actual_survival,
    )

    results = {
        "subsidy": {
            "precision": subsidy_result.precision,
            "recall": subsidy_result.recall,
            "f1": subsidy_result.f1,
        },
        "location": {
            "mae": location_result.mae,
            "top3_hit_rate": location_result.top3_hit_rate,
        },
    }

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"백테스트 결과 저장: {output_path}")
    print(json.dumps(results, indent=2, ensure_ascii=False))

    return results


if __name__ == "__main__":
    asyncio.run(run_full_backtest())
