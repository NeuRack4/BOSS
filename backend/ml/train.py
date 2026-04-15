"""
XGBoost 회귀 모델 학습

입력 : district_features 테이블 (monthly_revenue_label 있는 행)
       + 개인 조건 synthetic augmentation (in-memory)
출력 : backend/ml/models/revenue_model.pkl

레이블 = actual_per_txn_revenue × monthly_txn
  · actual_per_txn_revenue : sbiz 실데이터 거래당 매출 (상권별 고정)
  · monthly_txn            : 좌석 수 × 영업시간 × 회전율 × 점유율 × 영업일수 (개인 조건)
→ 같은 상권이라도 개인 조건(좌석·시간·가격·영업일)이 다르면 레이블이 달라짐
→ 모델은 "어떤 상권에서 어떤 조건으로 창업하면 월 매출이 얼마"를 학습
"""
import pathlib
import pickle
from itertools import product

import numpy as np
from backend.db.client import get_supabase

_MODEL_PATH = pathlib.Path(__file__).parent / "models" / "revenue_model.pkl"

# 카페 체류시간 · 좌석 점유율 (features.py·location.py와 동일 상수)
_CAFE_STAY_MIN  = 90
_OCCUPANCY      = 0.6
_TURNS_PER_HOUR = 60 / _CAFE_STAY_MIN  # ≈ 0.667
_BASELINE_PRICE = 4_500  # zone_label 산출 기준 객단가 (원) — sbiz 실데이터 평균

# 상권 단위 피처 (district_features 컬럼)
_DISTRICT_FEATURES = [
    "daily_floating_pop",   # 총 유동인구
    "pop_age_20",           # 20대 유동인구
    "pop_age_30",           # 30대 유동인구
    "pop_weekend",          # 주말 유동인구
    "cafe_density",         # 상권 유형 인코딩 (1=골목, 2=발달, 3=전통, 4=관광)
    "monthly_txn_count",    # 월 거래건수
    "rent_per_sqm",         # 임대료 (있는 경우)
]

# 개인 조건 피처 (synthetic augmentation)
_PERSONAL_FEATURES = [
    "seat_count",       # 좌석 수
    "operating_hours",  # 일 영업시간
    "avg_price",        # 객단가 (원)
    "operating_days",   # 월 영업일수
]

_FEATURES = _DISTRICT_FEATURES + _PERSONAL_FEATURES

# 하이브리드 레이블 전략
# txn >= MIN_TXN_FOR_REAL_LABEL → monthly_revenue_label (상권 실데이터, 차별화 신호 유지)
# txn <  MIN_TXN_FOR_REAL_LABEL → zone_label (권역 평균, 희소 상권 노이즈 제거)
_MIN_TXN_FOR_REAL_LABEL = 5_000

# Synthetic augmentation 그리드
_PERSONAL_GRID = list(product(
    [10, 20, 30, 50, 70, 100],          # seat_count
    [6, 8, 10, 12, 14],                 # operating_hours
    [3000, 4500, 6000, 8000, 10000],    # avg_price
    [20, 22, 25, 26, 30],              # operating_days
))


def _monthly_txn(seat_count: float, operating_hours: float, operating_days: float) -> float:
    return seat_count * operating_hours * _TURNS_PER_HOUR * _OCCUPANCY * operating_days


def train() -> dict:
    try:
        import xgboost as xgb
        from sklearn.model_selection import cross_val_score
    except ImportError:
        raise ImportError("uv pip install xgboost scikit-learn")

    db = get_supabase()
    rows = (
        db.table("district_features")
        .select(",".join(_DISTRICT_FEATURES + ["monthly_revenue_label", "zone_label", "monthly_txn_count"]))
        .not_.is_("zone_label", "null")
        .execute()
        .data or []
    )

    if len(rows) < 5:
        raise ValueError(f"학습 데이터 부족: {len(rows)}건 (최소 5개 상권 필요)")

    print(f"상권 수: {len(rows):,}개  ×  개인 조건 조합: {len(_PERSONAL_GRID):,}개")

    X, y = _augment(rows)
    print(f"총 학습 샘플: {len(y):,}건")

    model = xgb.XGBRegressor(
        n_estimators=400,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
    )

    scores = cross_val_score(model, X, y, cv=5, scoring="neg_mean_absolute_error")
    mae_cv = -scores.mean()
    print(f"5-Fold CV MAE: {mae_cv:,.0f}원")

    model.fit(X, y)

    importance = dict(zip(_FEATURES, model.feature_importances_))
    print("\n피처 중요도:")
    for feat, imp in sorted(importance.items(), key=lambda x: -x[1]):
        print(f"  {feat:25s} {imp:.4f}")

    _MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_MODEL_PATH, "wb") as f:
        pickle.dump({"model": model, "features": _FEATURES}, f)

    print(f"\n모델 저장: {_MODEL_PATH}")
    return {"districts": len(rows), "samples": len(y), "mae_cv": round(mae_cv)}


def _augment(rows: list[dict]):
    X, y = [], []
    real_count, zone_count = 0, 0

    for r in rows:
        txn_count = int(r.get("monthly_txn_count") or 0)

        # 하이브리드 레이블 선택
        if txn_count >= _MIN_TXN_FOR_REAL_LABEL and r.get("monthly_revenue_label"):
            per_txn = float(r["monthly_revenue_label"])
            real_count += 1
        elif r.get("zone_label"):
            per_txn = float(r["zone_label"])
            zone_count += 1
        else:
            continue

        district_vals = [float(r.get(f) or 0) for f in _DISTRICT_FEATURES]

        for seat, hours, price, days in _PERSONAL_GRID:
            txn = _monthly_txn(seat, hours, days)
            price_ratio = float(price) / _BASELINE_PRICE
            label = per_txn * price_ratio * txn
            X.append(district_vals + [float(seat), float(hours), float(price), float(days)])
            y.append(label)

    print(f"  실데이터 레이블(txn≥{_MIN_TXN_FOR_REAL_LABEL:,}): {real_count:,}개 상권")
    print(f"  zone_label fallback: {zone_count:,}개 상권")
    return np.array(X, dtype=float), np.array(y, dtype=float)


if __name__ == "__main__":
    train()
