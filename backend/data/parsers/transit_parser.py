"""
서울 지하철역 + 버스정류장 파서
저장 경로:
  지하철: backend/data/seeds/transit/subway_stations.csv
  버스:   backend/data/seeds/transit/bus_stops.xlsx

실제 컬럼:
  subway_stations.csv — 역사_ID, 역사명, 호선, 위도, 경도
  bus_stops.xlsx      — NODE_ID, ARS_ID, 정류소명, X좌표(경도), Y좌표(위도), 정류소타입

다운로드:
  지하철: https://data.seoul.go.kr/dataList/OA-121/S/1/datasetView.do
  버스:   https://data.seoul.go.kr/dataList/OA-15067/S/1/datasetView.do
"""
import pathlib
import pandas as pd
from backend.db.client import get_supabase

_SEEDS = pathlib.Path(__file__).parent.parent / "seeds" / "transit"


def _parse_subway() -> list[dict]:
    """역사마스터 CSV → subway 레코드."""
    for fname in ("subway_stations.csv",):
        fpath = _SEEDS / fname
        if not fpath.exists():
            print(f"[건너뜀] 지하철 파일 없음: {fpath}")
            return []

    for enc in ("cp949", "utf-8-sig", "euc-kr"):
        try:
            df = pd.read_csv(fpath, encoding=enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        print("[경고] 지하철 파일 인코딩 감지 실패")
        return []

    # 실제 컬럼: 역사_ID, 역사명, 호선, 위도, 경도
    lat_col = next((c for c in df.columns if "위도" in c or c.lower() == "lat"), None)
    lng_col = next((c for c in df.columns if "경도" in c or c.lower() == "lng"), None)
    name_col = next((c for c in df.columns if "역사명" in c or "역명" in c or "station" in c.lower()), None)

    if not all([lat_col, lng_col, name_col]):
        print(f"[경고] 지하철 컬럼 탐지 실패. 실제 컬럼: {list(df.columns)}")
        return []

    df["lat"] = pd.to_numeric(df[lat_col], errors="coerce")
    df["lng"] = pd.to_numeric(df[lng_col], errors="coerce")
    df = df.dropna(subset=["lat", "lng"])
    df = df[(df["lat"].between(33, 39)) & (df["lng"].between(124, 132))]

    records = [
        {"name": str(row[name_col]).strip(), "type": "subway", "lat": row["lat"], "lng": row["lng"]}
        for _, row in df.iterrows()
        if str(row[name_col]).strip()
    ]
    print(f"  지하철: {len(records):,}건 파싱")
    return records


def _parse_bus() -> list[dict]:
    """버스정류소 xlsx → bus 레코드."""
    # xlsx 우선, csv 폴백
    for fname in ("bus_stops.xlsx", "bus_stops.csv"):
        fpath = _SEEDS / fname
        if fpath.exists():
            break
    else:
        print(f"[건너뜀] 버스 파일 없음: {_SEEDS}/bus_stops.{{xlsx,csv}}")
        return []

    if fpath.suffix == ".xlsx":
        df = pd.read_excel(fpath)
    else:
        for enc in ("cp949", "utf-8-sig"):
            try:
                df = pd.read_csv(fpath, encoding=enc)
                break
            except UnicodeDecodeError:
                continue

    # 실제 컬럼: NODE_ID, ARS_ID, 정류소명, X좌표(경도), Y좌표(위도), 정류소타입
    # 주의: 서울 버스 데이터는 X좌표=경도(lng), Y좌표=위도(lat)
    lat_col  = next((c for c in df.columns if c in ("Y좌표", "위도", "lat", "gpsY")), None)
    lng_col  = next((c for c in df.columns if c in ("X좌표", "경도", "lng", "gpsX")), None)
    name_col = next((c for c in df.columns if "정류소명" in c or "정류장명" in c or "stationName" in c.lower()), None)

    if not all([lat_col, lng_col, name_col]):
        print(f"[경고] 버스 컬럼 탐지 실패. 실제 컬럼: {list(df.columns)}")
        return []

    df["lat"] = pd.to_numeric(df[lat_col], errors="coerce")
    df["lng"] = pd.to_numeric(df[lng_col], errors="coerce")
    df = df.dropna(subset=["lat", "lng"])
    df = df[(df["lat"].between(33, 39)) & (df["lng"].between(124, 132))]

    records = [
        {"name": str(row[name_col]).strip(), "type": "bus", "lat": row["lat"], "lng": row["lng"]}
        for _, row in df.iterrows()
        if str(row[name_col]).strip()
    ]
    print(f"  버스: {len(records):,}건 파싱")
    return records


def parse_and_store() -> dict:
    subway = _parse_subway()
    bus    = _parse_bus()

    all_records = subway + bus
    if not all_records:
        print("[경고] 대중교통 파일이 없습니다. 다운로드 후 다시 실행하세요.")
        return {"subway": 0, "bus": 0}

    db = get_supabase()
    db.table("transit_stops").delete().neq("id", 0).execute()
    for i in range(0, len(all_records), 1000):
        db.table("transit_stops").insert(all_records[i:i + 1000]).execute()

    print(f"대중교통: 지하철 {len(subway):,}건, 버스 {len(bus):,}건 저장 완료")
    return {"subway": len(subway), "bus": len(bus)}
