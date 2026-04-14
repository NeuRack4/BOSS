"""
Supabase pgvector 검색

retrieve()                — law_chunks 벡터 유사도 검색 (법령 전용)
retrieve_mapo_stats()     — documents 테이블 mapo_stats 전용
retrieve_docs()           — documents 테이블 범용 (카테고리 지정)
retrieve_strategy()       — documents 테이블 strategy 전용
hybrid_retrieve()         — law_chunks 벡터 + FTS 하이브리드 검색

Hybrid Search 흐름:
  1. 쿼리를 BGE-M3로 임베딩
  2. SQL hybrid_search() RPC 호출
     — 벡터 순위 + FTS(tsvector simple) 순위를 RRF로 합산
  3. paragraph 청크가 검색되면 parent article 청크를 함께 반환 (컨텍스트 확장)
"""
import logging

from backend.db.client import get_supabase
from backend.rag.embeddings.bge_embeddings import embed_single

logger = logging.getLogger(__name__)


async def retrieve(
    query: str,
    category: str | None = None,
    match_count: int = 5,
    match_threshold: float = 0.7,
) -> list[dict]:
    """벡터 유사도 전용 검색 (backward compat)"""
    embedding = await embed_single(query)
    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
    supabase = get_supabase()

    result = supabase.rpc(
        "match_documents",
        {
            "query_embedding": embedding_str,
            "match_threshold": match_threshold,
            "match_count": match_count,
            "filter_category": category,
        },
    ).execute()

    if hasattr(result, "error") and result.error:
        logger.error("match_documents RPC 오류: %s", result.error)
        return []

    return result.data or []


async def retrieve_mapo_stats(
    query: str,
    match_count: int = 5,
    match_threshold: float = 0.5,
) -> list[dict]:
    """mapo_stats 전용 — documents 테이블 직접 벡터 검색"""
    embedding = await embed_single(query)
    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
    supabase = get_supabase()

    result = (
        supabase.rpc(
            "match_mapo_stats",
            {
                "query_embedding": embedding_str,
                "match_threshold": match_threshold,
                "match_count": match_count,
            },
        ).execute()
    )

    if hasattr(result, "error") and result.error:
        logger.error("match_mapo_stats RPC 오류: %s", result.error)
        return []

    return result.data or []


async def retrieve_docs(
    query: str,
    category: str,
    match_count: int = 5,
    match_threshold: float = 0.4,
) -> list[dict]:
    """documents 테이블 범용 벡터 검색 — match_docs RPC 사용 (카테고리 지정 필수)"""
    embedding = await embed_single(query)
    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
    supabase = get_supabase()

    result = supabase.rpc(
        "match_docs",
        {
            "query_embedding": embedding_str,
            "filter_category": category,
            "match_threshold": match_threshold,
            "match_count": match_count,
        },
    ).execute()

    if hasattr(result, "error") and result.error:
        logger.error("retrieve_docs RPC 오류 (category=%s): %s", category, result.error)
        return []

    return result.data or []


async def retrieve_strategy(
    query: str,
    match_count: int = 3,
    match_threshold: float = 0.45,
) -> list[dict]:
    """strategy 카테고리 전용"""
    return await retrieve_docs(query, "strategy", match_count, match_threshold)


async def hybrid_retrieve(
    query: str,
    category: str | None = None,
    match_count: int = 10,
    min_score: float = 0.3,
    expand_parent: bool = True,
) -> list[dict]:
    """
    하이브리드 검색: 벡터 + FTS (RRF 합산)

    expand_parent=True 시:
      paragraph 청크가 반환되면 해당 parent article 청크도 함께 포함.
      "제36조 검색" → 항 3개 매칭 → 조 전체 원문도 컨텍스트로 제공.
    """
    embedding = await embed_single(query)
    supabase = get_supabase()

    effective_min_score = 0.0 if category else min_score

    # PostgREST는 list[float]를 vector 타입으로 자동 변환하지 않음 → 문자열로 전달
    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

    result = supabase.rpc(
        "hybrid_search",
        {
            "query_text": query,
            "query_embedding": embedding_str,
            "match_count": match_count,
            "filter_category": category,
            # 카테고리 지정 시 min_score 불필요 (카테고리 자체가 필터)
            # 카테고리 없을 때만 임계값 적용해 크로스 카테고리 오염 방지
            "min_score": effective_min_score,
        },
    ).execute()

    if hasattr(result, "error") and result.error:
        logger.error("hybrid_search RPC 오류: %s", result.error)
        return []

    chunks: list[dict] = result.data or []

    if not expand_parent or not chunks:
        return chunks

    # 검색된 paragraph 청크의 parent article 청크 추가 확장
    existing_ids = {c["id"] for c in chunks}
    missing_parent_ids = {
        c["parent_doc_id"]
        for c in chunks
        if c.get("parent_doc_id") and c["parent_doc_id"] not in existing_ids
    }

    if missing_parent_ids:
        parent_result = (
            supabase.table("law_chunks")
            .select("id, content, metadata, chunk_type, paragraph_no, paragraph_char, parent_doc_id")
            .in_("id", list(missing_parent_ids))
            .execute()
        )
        for parent in (parent_result.data or []):
            parent["score"] = None  # 직접 매칭이 아닌 확장 결과
            chunks.append(parent)

    return chunks
