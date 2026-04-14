"""
지원사업 공고 스냅샷 백필 스크립트.

기업마당 API 는 현재 활성 공고만 반환하므로, 1회 호출 = 현재 가능한 모든 공고 확보.
필터: 대분류 '창업' + 지역(서울/전국).

실행 (프로젝트 루트):
    python -m backend.scripts.backfill_subsidies
"""
import asyncio

from backend.data.sync.subsidy_sync import sync_snapshot


async def main() -> None:
    count = await sync_snapshot()
    print(f"[backfill] 지원사업 공고 적재 완료: {count}건")


if __name__ == "__main__":
    asyncio.run(main())
