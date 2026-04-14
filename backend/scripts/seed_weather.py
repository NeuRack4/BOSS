"""
기상청 ASOS 서울 날씨 데이터를 Supabase weather_data 테이블에 저장하는 스크립트.

실행 방법 (프로젝트 루트에서):
    # 기본: 2021-01-01 ~ 오늘 전체
    python -m backend.scripts.seed_weather

    # 특정 연도만
    python -m backend.scripts.seed_weather 2024

    # 특정 기간 (날짜 범위)
    python -m backend.scripts.seed_weather 2024-01-01 2024-12-31

갱신 주기:
    APScheduler로 매일 전날 날씨 자동 수집 (scheduler.py에 등록 예정).

저장 방식:
    날짜별 UPSERT (중복 실행 안전).
"""

import asyncio
import sys
from datetime import date, timedelta

DEFAULT_START = date(2021, 1, 1)


def _parse_args() -> tuple[date, date]:
    args = sys.argv[1:]
    today = date.today()

    if not args:
        return DEFAULT_START, today - timedelta(days=1)

    if len(args) == 1:
        # 연도 하나 또는 날짜 하나
        arg = args[0]
        if len(arg) == 4 and arg.isdigit():
            year = int(arg)
            return date(year, 1, 1), min(date(year, 12, 31), today - timedelta(days=1))
        try:
            d = date.fromisoformat(arg)
            return d, today - timedelta(days=1)
        except ValueError:
            pass

    if len(args) == 2:
        try:
            return date.fromisoformat(args[0]), date.fromisoformat(args[1])
        except ValueError:
            pass

    print("사용법: python -m backend.scripts.seed_weather [start_date] [end_date]")
    print("예시:   python -m backend.scripts.seed_weather 2024-01-01 2024-12-31")
    sys.exit(1)


async def main() -> None:
    from backend.data.crawlers.weather_crawler import fetch_weather_range
    from backend.db.client import get_supabase

    start, end = _parse_args()
    print(f"[seed_weather] 수집 기간: {start} ~ {end}")

    # 월별로 분할하여 수집 (API 한 번에 최대 999건)
    records: list[dict] = []
    cur = start
    while cur <= end:
        if cur.month == 12:
            m_end = date(cur.year, 12, 31)
        else:
            m_end = date(cur.year, cur.month + 1, 1) - __import__("datetime").timedelta(days=1)
        m_end = min(m_end, end)

        print(f"  [{cur.strftime('%Y-%m')}] 수집 중...", end=" ", flush=True)
        rows = await fetch_weather_range(cur, m_end)
        print(f"{len(rows)}건")
        records.extend(rows)

        # 다음 달로 이동
        if cur.month == 12:
            cur = date(cur.year + 1, 1, 1)
        else:
            cur = date(cur.year, cur.month + 1, 1)

    if not records:
        print("[seed_weather] 수집된 데이터 없음 (API 키 미활성화 가능성)")
        print("  → 공공데이터포털에서 '기상청_ASOS_일자료_조회서비스' 신청 후 재시도")
        return

    print(f"\n[seed_weather] 총 {len(records)}건 Supabase 저장 중...")

    db = get_supabase()
    upsert_rows = [
        {
            "date": str(r["date"]),
            "avg_temp": r["avg_temp"],
            "rain_mm": r["rain_mm"],
            "max_wind": r["max_wind"],
            "avg_humid": r["avg_humid"],
        }
        for r in records
    ]

    # 배치 단위 UPSERT (날짜 기준 중복 방지)
    batch = 500
    saved = 0
    for i in range(0, len(upsert_rows), batch):
        chunk = upsert_rows[i : i + batch]
        db.table("weather_data").upsert(chunk, on_conflict="date").execute()
        saved += len(chunk)
        print(f"  {saved}건 저장 완료")

    print(f"\n[seed_weather] 완료 - weather_data 테이블 {saved}건")


if __name__ == "__main__":
    asyncio.run(main())
