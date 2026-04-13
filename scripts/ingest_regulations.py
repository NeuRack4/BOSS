"""
규제법령 수집 실행 스크립트
법제처 API → 청킹 → 임베딩 → Supabase 저장

실행: python -m scripts.ingest_regulations
"""
import asyncio
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.rag.ingest import ingest_regulations
from backend.data.crawlers.law_api import REGULATION_TARGETS


async def main() -> None:
    print("=== 규제법령 수집 시작 ===")
    print(f"대상 법령: {[t['name'] for t in REGULATION_TARGETS]}\n")

    count = await ingest_regulations()

    print(f"\n완료: {count}개 조문 저장됨")


if __name__ == "__main__":
    asyncio.run(main())
