"""
상권 단위 피처 엔지니어링
sbiz_tradearea (매출 레이블) + area_flpop.csv (유동인구) → district_features 저장

ML 단위: 상권_코드 (행정동 코드 아님)
  - dong_code 컬럼 = 상권_코드 (4-5자리)
  - dong_name 컬럼 = 상권_코드_명
"""
import pathlib
import pandas as pd
from backend.db.client import get_supabase

_SEEDS = pathlib.Path(__file__).parent.parent / "data" / "seeds"
_FLPOP_PATH  = _SEEDS / "flpop" / "area_flpop.csv"
_SBIZ_PATH   = _SEEDS / "sbiz"  / "seoul_revenue.csv"
_CAFE_KEYWORD = "커피"

# 상권_구분_코드_명 → 숫자 인코딩
_AREA_TYPE_ENC = {"골목상권": 1, "발달상권": 2, "전통시장": 3, "관광특구": 4}


def _load_csv(path: pathlib.Path) -> pd.DataFrame:
    for enc in ("cp949", "utf-8-sig", "euc-kr"):
        try:
            return pd.read_csv(path, encoding=enc)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"인코딩 감지 실패: {path}")


def build_and_store_features(quarter: str | None = None) -> int:
    """
    sbiz_tradearea DB + area_flpop.csv → district_features 생성/업데이트.
    quarter: '20241' 형태 (None이면 최신 분기 자동 선택)
    """
    # 1. 매출 레이블 (sbiz_tradearea — 이미 DB에 저장됨)
    db = get_supabase()
    sbiz_rows = (
        db.table("sbiz_tradearea")
        .select("dong_code, dong_name, monthly_revenue_avg, store_count, reference_month")
        .ilike("industry_name", f"%{_CAFE_KEYWORD}%")
        .execute()
        .data or []
    )

    if not sbiz_rows:
        # DB에 없으면 로컬 CSV에서 직접 로드
        if not _SBIZ_PATH.exists():
            raise FileNotFoundError(
                f"파일 없음: {_SBIZ_PATH}\n"
                "python -m backend.scripts.seed_seoul_ml --skip-api 먼저 실행"
            )
        sbiz_df = _load_csv(_SBIZ_PATH)
        sbiz_df = sbiz_df[sbiz_df["서비스_업종_코드_명"].str.contains(_CAFE_KEYWORD, na=False)]
        col_code    = next(c for c in sbiz_df.columns if "상권_코드" in c and "명" not in c)
        col_name    = next(c for c in sbiz_df.columns if "상권_코드_명" in c)
        col_rev     = next(c for c in sbiz_df.columns if "당월_매출_금액" in c)
        col_period  = next(c for c in sbiz_df.columns if "년분기" in c)
        sbiz_df = sbiz_df.rename(columns={
            col_code: "dong_code", col_name: "dong_name",
            col_rev: "monthly_revenue_avg", col_period: "reference_month",
        })
        sbiz_df["monthly_revenue_avg"] = pd.to_numeric(sbiz_df["monthly_revenue_avg"], errors="coerce")
        sbiz_rows = sbiz_df[["dong_code", "dong_name", "monthly_revenue_avg", "reference_month"]].to_dict("records")

    # 상권별 최신 분기만
    sbiz_map: dict[str, dict] = {}
    for r in sbiz_rows:
        code = str(r["dong_code"])
        ref  = str(r.get("reference_month") or "")
        if code not in sbiz_map or ref > str(sbiz_map[code].get("reference_month") or ""):
            sbiz_map[code] = r

    if quarter:
        sbiz_map = {k: v for k, v in sbiz_map.items() if str(v.get("reference_month")) == quarter}

    # 2. 유동인구 피처 (로컬 CSV)
    if not _FLPOP_PATH.exists():
        raise FileNotFoundError(
            f"파일 없음: {_FLPOP_PATH}\n"
            "다운로드: https://data.seoul.go.kr/dataList/OA-15568/S/1/datasetView.do\n"
            "저장 경로: backend/data/seeds/flpop/area_flpop.csv"
        )

    flpop_df = _load_csv(_FLPOP_PATH)

    col_area   = next((c for c in flpop_df.columns if "상권_코드" in c and "명" not in c), None)
    col_aname  = next((c for c in flpop_df.columns if "상권_코드_명" in c), None)
    col_atype  = next((c for c in flpop_df.columns if "구분_코드_명" in c), None)
    col_period = next((c for c in flpop_df.columns if "년분기" in c), None)
    col_total  = next((c for c in flpop_df.columns if "총_유동인구" in c), None)
    col_20     = next((c for c in flpop_df.columns if "연령대_20_유동" in c), None)
    col_30     = next((c for c in flpop_df.columns if "연령대_30_유동" in c), None)
    col_wknd   = next((c for c in flpop_df.columns if "토요일_유동" in c), None)
    col_1114   = next((c for c in flpop_df.columns if "11_14_유동" in c), None)
    col_1417   = next((c for c in flpop_df.columns if "14_17_유동" in c), None)

    # 최신 분기만
    flpop_df[col_period] = flpop_df[col_period].astype(str)
    latest_q = flpop_df[col_period].max()
    flpop_df = flpop_df[flpop_df[col_period] == latest_q]

    for col in [col_total, col_20, col_30, col_wknd, col_1114, col_1417]:
        if col:
            flpop_df[col] = pd.to_numeric(flpop_df[col], errors="coerce")

    flpop_map: dict[str, dict] = {
        str(row[col_area]): row.to_dict()
        for _, row in flpop_df.iterrows()
    }

    # 3. 임대료 (reb_rent — 상권명 키워드 매핑)
    rent_rows = db.table("reb_rent").select("*").execute().data or []
    rent_map  = _build_rent_map(rent_rows)

    # 4. 병합
    records = []
    for code, sbiz in sbiz_map.items():
        flpop = flpop_map.get(code, {})
        area_name = str(sbiz.get("dong_name") or flpop.get(col_aname, "") if col_aname else "")
        area_type_str = flpop.get(col_atype, "") if col_atype else ""
        area_type_enc = _AREA_TYPE_ENC.get(str(area_type_str), 0)

        total_pop = float(flpop[col_total]) if col_total and flpop.get(col_total) else None
        pop_20    = float(flpop[col_20])    if col_20  and flpop.get(col_20)    else None
        pop_30    = float(flpop[col_30])    if col_30  and flpop.get(col_30)    else None
        pop_wknd  = float(flpop[col_wknd])  if col_wknd and flpop.get(col_wknd) else None
        pop_1114  = float(flpop[col_1114])  if col_1114 and flpop.get(col_1114) else None
        pop_1417  = float(flpop[col_1417])  if col_1417 and flpop.get(col_1417) else None

        # 피크시간대 유동인구 비율
        peak_ratio = None
        if total_pop and total_pop > 0 and pop_1114 is not None and pop_1417 is not None:
            peak_ratio = round((pop_1114 + pop_1417) / total_pop, 4)

        rent = rent_map.get(area_name)

        rev = sbiz.get("monthly_revenue_avg")   # 당월_매출_금액 (상권 전체 합산)
        txn = sbiz.get("store_count") or 0       # 당월_매출_건수 (거래건수)
        txn = int(txn)

        # 점포당 매출 대신 거래당 매출로 정규화 (실제 점포 수 미포함 — 최선의 근사)
        # 거래당 매출 = 당월_매출_금액 / 당월_매출_건수 (단위: 원/건)
        per_txn_revenue = round(float(rev) / txn) if rev and txn > 0 else None

        records.append({
            "dong_name":             area_name,
            "dong_code":             code,
            "gu_name":               area_type_str,        # 상권구분 (골목/발달 등)
            "monthly_txn_count":     txn,                  # 월 거래건수
            "new_stores_1y":         None,
            "closed_stores_1y":      None,
            "survival_rate":         None,
            "cafe_density":          area_type_enc or None, # 상권유형 인코딩 (1~4)
            "daily_floating_pop":    int(total_pop) if total_pop else None,
            "pop_age_20":            int(pop_20) if pop_20 else None,    # 20대 유동인구
            "pop_age_30":            int(pop_30) if pop_30 else None,    # 30대 유동인구
            "rent_per_sqm":          rent,
            "pop_weekend":           int(pop_wknd) if pop_wknd else None, # 주말 유동인구
            "monthly_revenue_label": per_txn_revenue,      # 거래당 매출 (원/건, 학습 레이블용 베이스)
            "reference_period":      str(sbiz.get("reference_month") or ""),
        })

    if not records:
        print("district_features: 병합 결과 0건")
        return 0

    # ── 권역 클러스터 및 zone_label 계산 ────────────────────────────────────
    from backend.ml.zones import detect_zone, encode_zone

    MIN_TXN = 5_000  # zone_label 계산에 참여할 최소 거래건수

    # 1. 각 상권에 권역 배정
    for r in records:
        zone = detect_zone(r["dong_name"])
        r["zone_cluster"]     = zone
        r["zone_cluster_enc"] = encode_zone(zone)

    # 2. 권역별 가중평균 레이블 계산 (txn >= MIN_TXN 상권만 참여)
    from collections import defaultdict
    zone_rev_sum: dict[str, float] = defaultdict(float)
    zone_txn_sum: dict[str, float] = defaultdict(float)

    for r in records:
        label = r.get("monthly_revenue_label")
        txn   = r.get("monthly_txn_count") or 0
        if label and txn >= MIN_TXN:
            zone = r["zone_cluster"]
            zone_rev_sum[zone] += float(label) * txn   # 가중합
            zone_txn_sum[zone] += txn

    zone_label_map: dict[str, float] = {
        zone: zone_rev_sum[zone] / zone_txn_sum[zone]
        for zone in zone_rev_sum
        if zone_txn_sum[zone] > 0
    }

    # grand average fallback (전체 유효 상권)
    all_rev = sum(float(r["monthly_revenue_label"]) * (r.get("monthly_txn_count") or 0)
                  for r in records
                  if r.get("monthly_revenue_label") and (r.get("monthly_txn_count") or 0) >= MIN_TXN)
    all_txn = sum(r.get("monthly_txn_count") or 0
                  for r in records
                  if r.get("monthly_revenue_label") and (r.get("monthly_txn_count") or 0) >= MIN_TXN)
    grand_avg = (all_rev / all_txn) if all_txn > 0 else None

    # 3. 각 상권에 zone_label 배정
    for r in records:
        zone = r["zone_cluster"]
        if zone in zone_label_map:
            r["zone_label"] = round(zone_label_map[zone], 2)
        elif grand_avg is not None:
            r["zone_label"] = round(grand_avg, 2)
        else:
            r["zone_label"] = r.get("monthly_revenue_label")  # 원본 레이블 fallback

    covered = sum(1 for r in records if r.get("zone_label") is not None)
    print(f"권역 클러스터: {len(zone_label_map)}개 권역 계산, {covered}/{len(records)} 상권 zone_label 배정")
    # ────────────────────────────────────────────────────────────────────────

    for i in range(0, len(records), 500):
        db.table("district_features").upsert(
            records[i:i + 500], on_conflict="dong_code,reference_period"
        ).execute()

    print(f"district_features: {len(records):,}개 상권 저장 완료")
    return len(records)


def _build_rent_map(rent_rows: list[dict]) -> dict[str, float]:
    """상권명 키워드로 reb_rent 임대료 매핑 (상권명 ↔ 소분류 지역명)."""
    # 최신 분기 우선
    latest: dict[str, dict] = {}
    for r in rent_rows:
        gu = r["gu_name"]
        if gu not in latest or r["quarter"] > latest[gu]["quarter"]:
            latest[gu] = r

    # {지역명: 임대료} 반환 — 상권명에 지역명 포함 여부로 매핑
    return {gu: float(r["rent_per_sqm"]) for gu, r in latest.items()}
