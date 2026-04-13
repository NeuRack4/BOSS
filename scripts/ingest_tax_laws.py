"""
세금 법령 수집 실행 스크립트
법제처 API → 청킹 → 임베딩 → Supabase 저장 (category = "tax")

실행: python -m scripts.ingest_tax_laws
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.core.constants import DocumentCategory
from backend.data.crawlers.law_api import TAX_TARGETS, fetch_regulation
from backend.rag.ingest import ingest_documents


async def main() -> None:
    print("=== 세금 법령 수집 시작 ===")
    print(f"대상 법령: {[t['name'] for t in TAX_TARGETS]}\n")

    all_docs = []
    for target in TAX_TARGETS:
        print(f"[수집] {target['name']} ...")
        docs = await fetch_regulation(target)
        print(f"  → {len(docs)}개 조문 수집")
        all_docs.extend(docs)

    if not all_docs:
        print("\n수집된 조문이 없습니다. 법제처 API 연결을 확인하세요.")
        return

    print(f"\n[임베딩 + 저장] 총 {len(all_docs)}개 조문 처리 중 ...")
    count = await ingest_documents(all_docs, DocumentCategory.TAX)
    print(f"\n완료: {count}개 조문 저장됨 (category=tax)")


if __name__ == "__main__":
    asyncio.run(main())
