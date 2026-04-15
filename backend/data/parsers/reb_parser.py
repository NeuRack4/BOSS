"""
한국부동산원 소규모상가 임대료 CSV 파서
파일 경로: backend/data/seeds/reb/reb_rent.csv

실제 파일 형식 (2024Q3~):
  행 0: 헤더 라벨 (No, 지역, 지역, 지역, 2024년 3분기, ...)
  행 1: 단위 라벨 (No, 지역, 지역, 지역, 임대료, ...)
  행 2: 단위 (천원/㎡, ...)
  행 3~: 실제 데이터

  컬럼 구조 (skiprows=2 기준):
    No | 지역(대) | 지역.1(중) | 지역.2(소) | 천원/㎡(Q3_24) | 천원/㎡.1(Q4_24) | ...

분기 매핑 (파일 내 6개 분기):
  천원/㎡   → 20243 (2024년 3분기)
  천원/㎡.1 → 20244
  천원/㎡.2 → 20251
  천원/㎡.3 → 20252
  천원/㎡.4 → 20253
  천원/㎡.5 → 20254

다운로드: https://www.reb.or.kr/r-one/statistics
저장 경로: backend/data/seeds/reb/reb_rent.csv
"""
import pathlib
import pandas as pd
from backend.db.client import get_supabase

_FILE = pathlib.Path(__file__).parent.parent / "seeds" / "reb" / "reb_rent.csv"

# 파일 내 분기 컬럼(천원/㎡, 천원/㎡.1, ...) → 분기 코드 매핑
_QUARTER_MAP = {
    "천원/㎡":   "20243",
    "천원/㎡.1": "20244",
    "천원/㎡.2": "20251",
    "천원/㎡.3": "20252",
    "천원/㎡.4": "20253",
    "천원/㎡.5": "20254",
}

# 서울 지역만 저장 (지역 대분류 기준)
_SEOUL_ONLY = True


def parse_and_store(filepath: pathlib.Path = _FILE) -> int:
    if not filepath.exists():
        raise FileNotFoundError(
            f"파일 없음: {filepath}\n"
            "다운로드: https://www.reb.or.kr/r-one/statistics\n"
            "  → 임대동향 → 지역별 임대료 → 소규모상가 → CSV 다운로드\n"
            "저장 경로: backend/data/seeds/reb/reb_rent.csv"
        )

    for enc in ("cp949", "utf-8-sig", "euc-kr"):
        try:
            df = pd.read_csv(filepath, encoding=enc, skiprows=2)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError(f"파일 인코딩 감지 실패: {filepath}")

    # 컬럼명 표준화: 처음 4개 컬럼 = No, 대분류, 중분류, 소분류
    cols = list(df.columns)
    df.columns = ["no", "region_l", "region_m", "region_s"] + cols[4:]

    # 서울만 필터
    if _SEOUL_ONLY:
        df = df[df["region_l"].astype(str).str.strip() == "서울"]

    # 빈 소분류 행 제거
    df = df[df["region_s"].notna() & (df["region_s"].astype(str).str.strip() != "")]

    # wide → long: 분기 컬럼만 melt
    quarter_cols = [c for c in df.columns if c in _QUARTER_MAP]
    if not quarter_cols:
        print(f"[경고] 분기 컬럼 탐지 실패. 실제 컬럼: {list(df.columns)}")
        return 0

    df_long = df.melt(
        id_vars=["region_l", "region_m", "region_s"],
        value_vars=quarter_cols,
        var_name="q_col",
        value_name="rent_per_sqm",
    )
    df_long["quarter"] = df_long["q_col"].map(_QUARTER_MAP)
    df_long["gu_name"] = df_long["region_s"].astype(str).str.strip()

    # 숫자 변환 + 유효값만
    df_long["rent_per_sqm"] = pd.to_numeric(df_long["rent_per_sqm"], errors="coerce")
    df_long = df_long[df_long["rent_per_sqm"] > 0].dropna(subset=["rent_per_sqm", "quarter"])

    records = [
        {
            "gu_name":      row["gu_name"],
            "rent_per_sqm": float(row["rent_per_sqm"]),
            "quarter":      row["quarter"],
        }
        for _, row in df_long.iterrows()
    ]

    db = get_supabase()
    for i in range(0, len(records), 1000):
        db.table("reb_rent").upsert(
            records[i:i + 1000], on_conflict="gu_name,quarter"
        ).execute()

    print(f"임대료: {len(records):,}건 저장 완료")
    return len(records)
