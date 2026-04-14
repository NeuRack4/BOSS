"""
지원사업 공고 동기화 모듈.

기업마당 API 는 '현재 활성' 스냅샷만 반환하므로 단일 호출 후 upsert.
external_id UNIQUE 로 중복 방지, on_conflict 로 기존 레코드 갱신.
"""
from datetime import date

from backend.data.crawlers.bizinfo import fetch_startup_programs
from backend.db.client import get_supabase


async def _upsert(programs: list[dict]) -> int:
    if not programs:
        return 0
    supabase = get_supabase()

    # updated_at 은 서버 기본값 사용 (컬럼 미포함)
    rows = [{k: v for k, v in p.items() if k != "updated_at"} for p in programs]

    batch_size = 50
    total = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        supabase.table("subsidy_programs").upsert(
            batch, on_conflict="external_id"
        ).execute()
        total += len(batch)
    return total


async def sync_snapshot() -> int:
    """전체 스냅샷 수집 → upsert. 수집 건수 반환."""
    programs = await fetch_startup_programs()
    return await _upsert(programs)


async def sync_daily_if_needed() -> tuple[bool, int]:
    """
    오늘 자 동기화 로그가 없으면 스냅샷 수집 후 기록.
    동시 호출 안전: subsidy_fetch_log(pk=fetch_date) 선점 insert 로 레이스 방지.
    반환: (실행 여부, 적재 건수)
    """
    supabase = get_supabase()
    today = date.today()

    try:
        supabase.table("subsidy_fetch_log").insert(
            {"fetch_date": today.isoformat(), "fetched_count": 0}
        ).execute()
    except Exception:
        return (False, 0)

    count = await sync_snapshot()

    supabase.table("subsidy_fetch_log").update(
        {"fetched_count": count}
    ).eq("fetch_date", today.isoformat()).execute()

    return (True, count)
