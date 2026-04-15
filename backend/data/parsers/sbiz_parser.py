"""
서울시 상권분석서비스 (추정매출-상권) CSV 파서
출처: 서울 열린데이터광장 OA-15572 / data.go.kr 15147229

다운로드:
  https://data.seoul.go.kr/dataList/OA-15572/S/1/datasetView.do
  → 파일데이터 탭 → 최신 연도 ZIP 다운로드 → CSV 추출
저장 경로: backend/data/seeds/sbiz/seoul_revenue.csv

실제 컬럼 (2024년 기준):
  기준_년분기_코드, 상권_구분_코드, 상권_구분_코드_명,
  상권_코드, 상권_코드_명, 서비스_업종_코드, 서비스_업종_코드_명,
  당월_매출_금액, 당월_매출_건수, 주중_매출_금액, 주말_매출_금액, ...

※ 상권_코드 단위 데이터 (행정동 코드 아님).
   행정동 매핑 필요 시 OA-15568 (상권-행정동 연계) 참조.
"""
import csv
import pathlib
from backend.db.client import get_supabase

_FILE = pathlib.Path(__file__).parent.parent / "seeds" / "sbiz" / "seoul_revenue.csv"

_CAFE_KEYWORDS = ["커피", "카페", "음료"]


def parse_and_store(filepath: pathlib.Path = _FILE) -> int:
    if not filepath.exists():
        raise FileNotFoundError(
            f"파일 없음: {filepath}\n"
            "다운로드: https://data.seoul.go.kr/dataList/OA-15572/S/1/datasetView.do\n"
            "  → 파일데이터 탭 → 최신 연도 ZIP 다운로드 → CSV 추출\n"
            "저장 경로: backend/data/seeds/sbiz/seoul_revenue.csv"
        )

    records = []
    for enc in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            with open(filepath, encoding=enc, newline="") as f:
                reader = csv.DictReader(f)
                header = list(reader.fieldnames or [])

                # 실제 컬럼명 직접 매핑
                col_area_code   = next((c for c in header if "상권_코드" in c and "명" not in c), None)
                col_area_name   = next((c for c in header if "상권_코드_명" in c), None)
                col_ind_name    = next((c for c in header if "업종_코드_명" in c), None)
                col_revenue     = next((c for c in header if "당월_매출_금액" in c), None)
                col_count       = next((c for c in header if "당월_매출_건수" in c), None)
                col_period      = next((c for c in header if "년분기" in c or "년_분기" in c), None)

                missing = [k for k, v in {
                    "상권_코드": col_area_code, "상권_코드_명": col_area_name,
                    "업종_코드_명": col_ind_name, "당월_매출_금액": col_revenue,
                    "기준_년분기": col_period,
                }.items() if v is None]
                if missing:
                    print(f"[경고] 컬럼 탐지 실패: {missing}")
                    print(f"  실제 컬럼(앞 10개): {header[:10]}")

                for row in reader:
                    ind_name = row.get(col_ind_name, "") if col_ind_name else ""
                    if not any(kw in ind_name for kw in _CAFE_KEYWORDS):
                        continue

                    try:
                        revenue = float(str(row.get(col_revenue, "") or "0").replace(",", ""))
                        count   = int(float(str(row.get(col_count,   "") or "0").replace(",", "")))
                    except ValueError:
                        continue

                    records.append({
                        "dong_code":           row.get(col_area_code, "") if col_area_code else "",
                        "dong_name":           row.get(col_area_name, "") if col_area_name else "",
                        "gu_name":             "",
                        "industry_name":       ind_name,
                        "monthly_revenue_avg": revenue or None,
                        "store_count":         count,
                        "delivery_count":      None,
                        "reference_month":     row.get(col_period, "") if col_period else "",
                    })
            break  # 인코딩 성공 시 루프 탈출
        except UnicodeDecodeError:
            continue

    if not records:
        print("저장할 레코드 없음 (카페 업종 필터 결과 0건)")
        return 0

    db = get_supabase()
    for i in range(0, len(records), 1000):
        db.table("sbiz_tradearea").upsert(
            records[i:i + 1000], on_conflict="dong_code,industry_name,reference_month"
        ).execute()

    print(f"서울시 상권분석서비스(추정매출): {len(records):,}건 저장 완료")
    return len(records)
