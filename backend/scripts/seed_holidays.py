"""
공휴일 데이터를 수집하여 backend/data/seeds/holidays.json 에 저장하는 스크립트.

한국천문연구원 특일 정보 API (공공데이터포털)를 사용합니다.

실행 방법 (프로젝트 루트에서):
    # 기본: 2021~2026년 전체
    python -m backend.scripts.seed_holidays

    # 특정 연도만
    python -m backend.scripts.seed_holidays 2024 2025

갱신 주기:
    매년 1월 초 실행하여 해당 연도 공휴일 추가.
    APScheduler로 자동화 가능 (scheduler.py 참고).

저장 형식 (holidays.json):
    {
      "2024": {"20240101": "신정", "20240209": "설날 연휴", ...},
      "2025": {"20250101": "신정", ...}
    }
"""
import asyncio
import json
import sys
from pathlib import Path

HOLIDAYS_PATH = Path(__file__).parent.parent / "data" / "seeds" / "holidays.json"
DEFAULT_YEARS = list(range(2021, 2027))  # 2021~2026


async def main() -> None:
    from backend.data.crawlers.holiday_crawler import fetch_holidays_by_year

    # 연도 인수 파싱
    year_args = [a for a in sys.argv[1:] if a.isdigit()]
    years = [int(y) for y in year_args] if year_args else DEFAULT_YEARS

    print(f"[seed_holidays] 수집 대상 연도: {years}")

    # 기존 파일 로드 (있으면 병합)
    existing: dict[str, dict[str, str]] = {}
    if HOLIDAYS_PATH.exists():
        with open(HOLIDAYS_PATH, encoding="utf-8") as f:
            existing = json.load(f)
        print(f"[seed_holidays] 기존 데이터 로드: {list(existing.keys())}년")

    for year in years:
        print(f"[seed_holidays] {year}년 수집 중...")
        holidays = await fetch_holidays_by_year(year)
        existing[str(year)] = holidays
        print(f"[seed_holidays] {year}년: {len(holidays)}개 공휴일")

    # 연도순 정렬 후 저장
    sorted_data = dict(sorted(existing.items()))
    HOLIDAYS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(HOLIDAYS_PATH, "w", encoding="utf-8") as f:
        json.dump(sorted_data, f, ensure_ascii=False, indent=2)

    total = sum(len(v) for v in sorted_data.values())
    print(f"\n[seed_holidays] 완료 - {HOLIDAYS_PATH}")
    print(f"[seed_holidays] 총 {total}개 공휴일 ({len(sorted_data)}개 연도)")


if __name__ == "__main__":
    asyncio.run(main())
