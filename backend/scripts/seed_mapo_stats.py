"""
마포구 카페 통계 데이터를 RAG(documents 테이블)에 삽입하는 스크립트.

실행 방법 (프로젝트 루트에서):
    python -m backend.scripts.seed_mapo_stats

중복 실행 방지: source = '마포구 카페 상권 통계 2024' 로 시작하는 문서를
먼저 삭제한 뒤 재삽입하므로 여러 번 실행해도 중복되지 않음.
"""
import asyncio

from backend.core.constants import DocumentCategory
from backend.data.seeds.mapo_cafe_stats import MAPO_CAFE_STATS_DOCS
from backend.db.client import get_supabase
from backend.rag.ingest import ingest_documents

MAPO_SOURCES = {doc["source"] for doc in MAPO_CAFE_STATS_DOCS}


async def main() -> None:
    supabase = get_supabase()

    # 기존 데이터 삭제 (중복 방지)
    for source in MAPO_SOURCES:
        supabase.table("documents") \
            .delete() \
            .eq("category", DocumentCategory.MAPO_STATS) \
            .eq("source", source) \
            .execute()
    print(f"[seed] 기존 mapo_stats 문서 삭제 완료 ({len(MAPO_SOURCES)}개 소스)")

    # 신규 삽입
    count = await ingest_documents(MAPO_CAFE_STATS_DOCS, DocumentCategory.MAPO_STATS)
    print(f"[seed] 마포구 카페 통계 {count}개 청크 삽입 완료")


if __name__ == "__main__":
    asyncio.run(main())
