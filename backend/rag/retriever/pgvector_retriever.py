"""
Supabase pgvector 유사도 검색
match_documents RPC 함수 호출
"""
from backend.db.client import get_supabase
from backend.rag.embeddings.bge_embeddings import embed_single


async def retrieve(
    query: str,
    category: str | None = None,
    match_count: int = 5,
    match_threshold: float = 0.7,
) -> list[dict]:
    """쿼리를 임베딩하여 관련 문서 청크를 반환"""
    embedding = embed_single(query)
    supabase = get_supabase()

    result = supabase.rpc(
        "match_documents",
        {
            "query_embedding": embedding,
            "match_threshold": match_threshold,
            "match_count": match_count,
            "filter_category": category,
        },
    ).execute()

    return result.data or []
