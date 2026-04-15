"""
서울 전체 상가업소 + 유동인구 수집 → 로컬 parquet 저장
VwsmAdstrdStorW  : ~985,000건
VwsmAdstrdFlpopW : ~11,900건

저장 경로:
  backend/data/seeds/seoul_store_stats.parquet
  backend/data/seeds/seoul_flpop_stats.parquet
"""
import asyncio
import pathlib
import httpx
from backend.core.config import get_settings

_BASE_URL  = "http://openapi.seoul.go.kr:8088"
_DS_STORE  = "VwsmAdstrdStorW"
_DS_FLPOP  = "VwsmAdstrdFlpopW"
_PAGE_SIZE = 1000
_SEEDS_DIR = pathlib.Path(__file__).parent.parent / "seeds"

STORE_PATH = _SEEDS_DIR / "seoul_store_stats.parquet"
FLPOP_PATH = _SEEDS_DIR / "seoul_flpop_stats.parquet"


async def fetch_and_save_all_seoul() -> dict:
    """서울 전체 상가업소 + 유동인구 수집 후 로컬 parquet 저장."""
    try:
        import pandas as pd
    except ImportError:
        raise ImportError("uv pip install pandas pyarrow")

    _SEEDS_DIR.mkdir(parents=True, exist_ok=True)
    settings = get_settings()
    key = settings.seoul_open_api_key

    print("서울 전체 상가업소 수집 중...")
    store_rows = await _fetch_all_pages(key, _DS_STORE)
    print(f"  {len(store_rows):,}건 수집 완료")

    print("서울 전체 유동인구 수집 중...")
    flpop_rows = await _fetch_all_pages(key, _DS_FLPOP)
    print(f"  {len(flpop_rows):,}건 수집 완료")

    # 상가업소 집계 (행정동 × 업종 × 분기 최신)
    store_df = _aggregate_store(pd.DataFrame(store_rows))
    store_df.to_parquet(STORE_PATH, index=False)
    print(f"  저장: {STORE_PATH} ({len(store_df):,}행)")

    # 유동인구 집계 (행정동 × 분기 최신)
    flpop_df = _aggregate_flpop(pd.DataFrame(flpop_rows))
    flpop_df.to_parquet(FLPOP_PATH, index=False)
    print(f"  저장: {FLPOP_PATH} ({len(flpop_df):,}행)")

    return {"store_rows": len(store_df), "flpop_rows": len(flpop_df)}


async def _fetch_all_pages(key: str, dataset: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{_BASE_URL}/{key}/json/{dataset}/1/1/")
        total = int(r.json().get(dataset, {}).get("list_total_count", 0))

    ranges = [(s, min(s + _PAGE_SIZE - 1, total)) for s in range(1, total + 1, _PAGE_SIZE)]
    semaphore = asyncio.Semaphore(5)
    pages = await asyncio.gather(
        *[_fetch_page(key, dataset, s, e, semaphore) for s, e in ranges],
        return_exceptions=True,
    )
    rows = []
    for page in pages:
        if isinstance(page, list):
            rows.extend(page)
    return rows


async def _fetch_page(key: str, dataset: str, start: int, end: int, sem: asyncio.Semaphore) -> list[dict]:
    async with sem:
        url = f"{_BASE_URL}/{key}/json/{dataset}/{start}/{end}/"
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                r = await client.get(url)
                r.raise_for_status()
                return r.json().get(dataset, {}).get("row", [])
            except Exception as e:
                print(f"  [경고] {dataset} {start}~{end} 실패: {e}")
                return []


def _aggregate_store(df):
    import pandas as pd
    if df.empty:
        return df
    cols = {
        "ADSTRD_CD":       "dong_code",
        "ADSTRD_CD_NM":    "dong_name",
        "SIGNGU_CD_NM":    "gu_name",
        "SVC_INDUTY_CD_NM":"industry_name",
        "STOR_CO":         "store_count",
        "OPBIZ_STOR_CO":   "new_stores_1y",
        "CLSBIZ_STOR_CO":  "closed_stores_1y",
        "CLSBIZ_RT":       "clsbiz_rt",
        "STDR_YYQU_CD":    "quarter",
    }
    df = df[[c for c in cols if c in df.columns]].rename(columns=cols)
    # 동 × 업종 기준 최신 분기만
    df = df.sort_values("quarter", ascending=False).drop_duplicates(
        subset=["dong_code", "industry_name"]
    )
    df["store_count"]      = pd.to_numeric(df.get("store_count", 0), errors="coerce").fillna(0).astype(int)
    df["new_stores_1y"]    = pd.to_numeric(df.get("new_stores_1y", 0), errors="coerce").fillna(0).astype(int)
    df["closed_stores_1y"] = pd.to_numeric(df.get("closed_stores_1y", 0), errors="coerce").fillna(0).astype(int)
    df["survival_rate"]    = (1 - pd.to_numeric(df.get("clsbiz_rt", 0), errors="coerce").fillna(0) / 100).round(3)
    return df.drop(columns=["clsbiz_rt"], errors="ignore").reset_index(drop=True)


def _aggregate_flpop(df):
    import pandas as pd
    if df.empty:
        return df
    cols = {
        "ADSTRD_CD":    "dong_code",
        "ADSTRD_CD_NM": "dong_name",
        "SIGNGU_CD_NM": "gu_name",
        "TOT_FLPOP_CO": "tot_flpop",
        "STDR_YYQU_CD": "quarter",
    }
    df = df[[c for c in cols if c in df.columns]].rename(columns=cols)
    df = df.sort_values("quarter", ascending=False).drop_duplicates(subset=["dong_code"])
    df["daily_floating_pop"] = (
        pd.to_numeric(df["tot_flpop"], errors="coerce").fillna(0) / 91
    ).astype(int)
    return df.drop(columns=["tot_flpop"], errors="ignore").reset_index(drop=True)


def load_store() -> "pd.DataFrame":
    """저장된 parquet 로드."""
    import pandas as pd
    if not STORE_PATH.exists():
        raise FileNotFoundError(f"파일 없음: {STORE_PATH}\npython -m backend.scripts.seed_seoul_ml 먼저 실행")
    return pd.read_parquet(STORE_PATH)


def load_flpop() -> "pd.DataFrame":
    import pandas as pd
    if not FLPOP_PATH.exists():
        raise FileNotFoundError(f"파일 없음: {FLPOP_PATH}\npython -m backend.scripts.seed_seoul_ml 먼저 실행")
    return pd.read_parquet(FLPOP_PATH)
