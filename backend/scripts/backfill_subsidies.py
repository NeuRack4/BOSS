"""
지원사업 공고 3년치 백필 스크립트.

실행 (프로젝트 루트):
    python -m backend.scripts.backfill_subsidies
"""
import asyncio

from backend.data.sync.subsidy_sync import backfill_three_years


async def main() -> None:
    count = await backfill_three_years()
    print(f"[backfill] 적재 완료: {count}건")


if __name__ == "__main__":
    asyncio.run(main())
