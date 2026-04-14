"""
지원사업 공고 동기화 모듈.
- backfill: 최초 1회, 3년치 이력 적재
- sync_daily: 페이지 열람 시 하루 1회 증분 upsert
"""
from datetime import date, timedelta
from typing import Optional

from backend.data.crawlers.bizinfo import fetch_all_programs
from backend.db.client import get_supabase


async def _upsert_programs(programs: list[dict]) -> int:
    if not programs:
        return 0
    supabase = get_supabase()
    # external_id UNIQUE 제약으로 중복 방지 — on_conflict upsert
    supabase.table("subsidy_programs").upsert(
        programs,
        on_conflict="external_id",
    ).execute()
    return len(programs)


async def backfill_programs(
    start: date,
    end: Optional[date] = None,
    regions: Optional[list[Optional[str]]] = None,
) -> int:
    """최초 3년치 백필 — 지역별로 수집 후 기간 필터링."""
    end = end or date.today()
    regions = regions if regions is not None else ["마포", "서울", None]

    collected: dict[str, dict] = {}
    for region in regions:
        items = await fetch_all_programs(region=region, per_page=100, max_pages=50)
        for item in items:
            ext_id = item["external_id"]
            if not ext_id:
                continue
            # 기간에 걸치는 공고만 (시작일 미지정은 포함)
            sd = item.get("start_date")
            ed = item.get("end_date")
            if ed and ed < start.isoformat():
                continue
            if sd and sd > end.isoformat():
                continue
            collected[ext_id] = item

    return await _upsert_programs(list(collected.values()))


async def sync_daily_if_needed() -> tuple[bool, int]:
    """
    오늘 자 동기화 로그가 없으면 증분 수집 후 기록.
    동시 호출 안전: subsidy_fetch_log(pk=fetch_date) 선점 insert 로 레이스 방지.
    반환: (실행 여부, 적재 건수)
    """
    supabase = get_supabase()
    today = date.today()

    # 선점 insert — 이미 있으면 PostgREST 409 → 스킵
    try:
        supabase.table("subsidy_fetch_log").insert(
            {"fetch_date": today.isoformat(), "fetched_count": 0}
        ).execute()
    except Exception:
        return (False, 0)

    # 증분: 최근 30일만 수집해 upsert (신규만 반영, 기존은 갱신)
    items: dict[str, dict] = {}
    for region in ("마포", "서울", None):
        fetched = await fetch_all_programs(region=region, per_page=100, max_pages=20)
        for it in fetched:
            if it["external_id"]:
                items[it["external_id"]] = it

    count = await _upsert_programs(list(items.values()))

    supabase.table("subsidy_fetch_log").update(
        {"fetched_count": count}
    ).eq("fetch_date", today.isoformat()).execute()

    return (True, count)


async def backfill_three_years() -> int:
    """CLI 진입점."""
    today = date.today()
    start = date(today.year - 3, today.month, today.day)
    return await backfill_programs(start=start, end=today)
