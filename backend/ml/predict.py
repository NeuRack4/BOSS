"""
학습된 모델 추론

predict_one()       : 창업자 개인 조건 + 상권 피처 → 월 매출 예측 (실시간)
predict_and_store() : 전체 상권 기본 조건 배치 예측 → DB 업데이트
"""
import pathlib
import pickle

import numpy as np
from backend.db.client import get_supabase

_MODEL_PATH = pathlib.Path(__file__).parent / "models" / "revenue_model.pkl"

# 배치 예측용 기본 개인 조건
_DEFAULT_PERSONAL = {
    "seat_count":      30,
    "operating_hours": 10,
    "avg_price":       5000,
    "operating_days":  25,
}

_BUNDLE: dict | None = None


def _load() -> dict:
    global _BUNDLE
    if _BUNDLE is None:
        if not _MODEL_PATH.exists():
            raise FileNotFoundError(
                f"모델 없음: {_MODEL_PATH}\n"
                "먼저 python -m backend.ml.train 실행"
            )
        with open(_MODEL_PATH, "rb") as f:
            _BUNDLE = pickle.load(f)
    return _BUNDLE


def predict_bulk(
    district_rows: list[dict],
    seat_count: int,
    operating_hours: float,
    avg_price: int,
    operating_days: int,
) -> list[int]:
    """
    여러 상권에 동일한 개인 조건을 적용해 월 매출 일괄 예측.
    단일 numpy 배치로 처리하므로 predict_one 반복보다 빠름.
    """
    bundle = _load()
    model    = bundle["model"]
    features = bundle["features"]

    personal = [float(seat_count), float(operating_hours), float(avg_price), float(operating_days)]
    X = [
        [float(r.get(f) or 0) for f in features[:-4]] + personal
        for r in district_rows
    ]
    preds = model.predict(np.array(X, dtype=float))
    return [max(0, round(float(p))) for p in preds]


def predict_one(
    district_row: dict,
    seat_count: int,
    operating_hours: float,
    avg_price: int,
    operating_days: int,
) -> int:
    """
    창업자 개인 조건 + 상권 피처 → 예측 월 매출 (원/월).

    Args:
        district_row: district_features 테이블 행 (상권 피처 포함)
        seat_count:      좌석 수
        operating_hours: 일 영업시간
        avg_price:       객단가 (원)
        operating_days:  월 영업일수

    Returns:
        예측 월 매출 (원, 정수)
    """
    bundle = _load()
    model    = bundle["model"]
    features = bundle["features"]

    personal = {
        "seat_count":      float(seat_count),
        "operating_hours": float(operating_hours),
        "avg_price":       float(avg_price),
        "operating_days":  float(operating_days),
    }

    x = np.array(
        [[float(district_row.get(f) or personal.get(f) or 0) for f in features]],
        dtype=float,
    )
    return max(0, round(float(model.predict(x)[0])))


def predict_and_store() -> int:
    """
    전체 상권에 기본 개인 조건(_DEFAULT_PERSONAL)을 적용해 월 매출 예측 후
    district_features.predicted_monthly_revenue 업데이트.
    """
    bundle = _load()
    model    = bundle["model"]
    features = bundle["features"]

    db = get_supabase()
    rows = db.table("district_features").select("id," + ",".join(features[:-4])).execute().data or []

    if not rows:
        print("예측할 데이터 없음")
        return 0

    ids, X = [], []
    personal_vals = [float(_DEFAULT_PERSONAL[f]) for f in ["seat_count", "operating_hours", "avg_price", "operating_days"]]
    for r in rows:
        ids.append(r["id"])
        district_vals = [float(r.get(f) or 0) for f in features[:-4]]
        X.append(district_vals + personal_vals)

    preds = model.predict(np.array(X, dtype=float))

    for rid, p in zip(ids, preds):
        db.table("district_features").update(
            {"predicted_monthly_revenue": max(0, round(float(p)))}
        ).eq("id", rid).execute()

    print(f"배치 예측 완료: {len(ids):,}개 상권 (기본 조건: {_DEFAULT_PERSONAL})")
    return len(ids)
