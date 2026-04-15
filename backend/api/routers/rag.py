"""
RAG 관련 API 엔드포인트

POST /rag/ingest/all    — docs/ 폴더 전체 수집 (관리자용)
POST /rag/ingest/file   — 특정 파일 수집 (관리자용)
POST /rag/search        — 유사도 검색
POST /rag/summarize     — 검색 결과 LLM 요약
GET  /rag/stats         — 카테고리별 저장 문서 수 조회
"""
from pathlib import Path

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.core.constants import DocumentCategory, LEGAL_DISCLAIMER
from backend.core.config import get_settings
from backend.rag.document_loader import load_document, load_docs_folder
from backend.rag.ingest import ingest_law_chunks
from backend.rag.retriever.pgvector_retriever import retrieve, hybrid_retrieve
from backend.db.client import get_supabase

router = APIRouter()

DOCS_DIR = Path("docs")


# ── Request / Response 스키마 ──────────────────────────────────────────────

class IngestFileRequest(BaseModel):
    file_path: str = Field(..., description="수집할 파일 경로 (예: docs/사업자등록_신청서.pdf)")


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="검색 쿼리")
    category: DocumentCategory | None = Field(None, description="카테고리 필터 (없으면 전체 검색)")
    match_count: int = Field(5, ge=1, le=20, description="반환할 최대 청크 수")
    match_threshold: float = Field(0.7, ge=0.0, le=1.0, description="유사도 최소 기준")


class SearchResult(BaseModel):
    id: int
    content: str
    metadata: dict
    similarity: float
    disclaimer: str = LEGAL_DISCLAIMER


class IngestResult(BaseModel):
    saved_chunks: int
    message: str


class StatsResult(BaseModel):
    category: str
    count: int


class SummarizeChunk(BaseModel):
    content: str
    metadata: dict


class SummarizeRequest(BaseModel):
    query: str = Field(..., min_length=1, description="사용자 질문")
    chunks: list[SummarizeChunk] = Field(..., description="RAG 검색 결과 청크 목록")


class SummarizeResult(BaseModel):
    summary: str
    disclaimer: str = LEGAL_DISCLAIMER


# ── 엔드포인트 ─────────────────────────────────────────────────────────────

@router.post("/ingest/all", response_model=IngestResult, summary="docs/ 폴더 전체 수집")
async def ingest_all():
    """
    docs/ 폴더 안의 모든 .pdf / .md / .txt 파일을 청킹하여 pgvector에 저장.
    이미 저장된 문서는 중복 삽입될 수 있으므로 운영 환경에서는 기존 데이터 삭제 후 실행 권장.
    """
    if not DOCS_DIR.exists():
        raise HTTPException(status_code=404, detail=f"docs 폴더가 없습니다: {DOCS_DIR.resolve()}")

    chunks = load_docs_folder(DOCS_DIR)
    if not chunks:
        return IngestResult(saved_chunks=0, message="수집할 파일이 없습니다.")

    from itertools import groupby
    chunks_sorted = sorted(chunks, key=lambda x: x["category"])
    total = 0
    for category, group in groupby(chunks_sorted, key=lambda x: x["category"]):
        docs = [
            {"source": c["source"], "chunk_index": c["chunk_index"],
             "content": c["content"], "metadata": c["metadata"]}
            for c in group
        ]
        total += await ingest_law_chunks(docs, DocumentCategory(category))

    return IngestResult(saved_chunks=total, message=f"{total}개 청크를 pgvector에 저장했습니다.")


@router.post("/ingest/file", response_model=IngestResult, summary="특정 파일 수집")
async def ingest_file(req: IngestFileRequest):
    """
    지정한 파일을 청킹하여 pgvector에 저장.
    """
    path = Path(req.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"파일을 찾을 수 없습니다: {req.file_path}")

    chunks = load_document(path)
    if not chunks:
        return IngestResult(saved_chunks=0, message="청킹 결과가 없습니다.")

    category = DocumentCategory(chunks[0]["category"])
    docs = [
        {"source": c["source"], "chunk_index": c["chunk_index"],
         "content": c["content"], "metadata": c["metadata"]}
        for c in chunks
    ]
    saved = await ingest_law_chunks(docs, category)

    return IngestResult(
        saved_chunks=saved,
        message=f"[{path.name}] → {saved}청크 저장 완료 (카테고리: {category})",
    )


@router.post("/search", response_model=list[SearchResult], summary="RAG 유사도 검색")
async def search(req: SearchRequest):
    """
    쿼리를 임베딩하여 Supabase pgvector에서 유사한 문서 청크를 반환.
    벡터 + FTS 하이브리드(RRF) 검색으로 한국어 법령 텍스트에 최적화.
    """
    chunks = await hybrid_retrieve(
        query=req.query,
        category=req.category,
        match_count=req.match_count,
        min_score=req.match_threshold,
    )
    return [
        SearchResult(
            id=r["id"],
            content=r["content"],
            metadata=r.get("metadata") or {},
            similarity=r.get("similarity") or 0.0,
            disclaimer=LEGAL_DISCLAIMER,
        )
        for r in chunks
    ]


_RAG_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 1인 창업자 전담 AI 법령 비서입니다.
아래 법령·규정 원문을 바탕으로 창업자의 질문에 답합니다.

답변 원칙:
- 원문에 근거한 내용만 답변하고 출처(법령명, 조항)를 명시
- 창업자가 바로 이해할 수 있는 쉬운 언어로 설명
- 실행 가능한 다음 단계 1~2가지 제시
- 법적 최종 판단은 전문가에게 확인하도록 안내
- 한국어, 간결하게
"""


@router.post("/summarize", response_model=SummarizeResult, summary="RAG 검색 결과 LLM 요약")
async def summarize(req: SummarizeRequest):
    """
    검색된 법령 청크를 바탕으로 Claude가 창업자 질문에 맞게 요약·해석.
    """
    if not req.chunks:
        return SummarizeResult(
            summary="관련 법령 문서를 찾지 못했습니다. 다른 키워드로 검색해보세요."
        )

    context_parts = []
    for i, chunk in enumerate(req.chunks, 1):
        source = chunk.metadata.get("source") or chunk.metadata.get("law", "출처 미상")
        article = chunk.metadata.get("article", "")
        label = f"[{i}] {source}" + (f" {article}" if article else "")
        context_parts.append(f"{label}\n{chunk.content}")

    context_text = "\n\n---\n\n".join(context_parts)
    user_message = f"질문: {req.query}\n\n[관련 법령 원문]\n{context_text}"

    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model=get_settings().claude_model,
        max_tokens=1024,
        system=_RAG_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    return SummarizeResult(summary=message.content[0].text)


@router.get("/stats", response_model=list[StatsResult], summary="카테고리별 문서 수 조회")
async def stats():
    """law_chunks 테이블의 카테고리별 청크 수를 반환."""
    supabase = get_supabase()
    law_categories = [c for c in DocumentCategory if c != DocumentCategory.MAPO_STATS]
    rows = []
    for cat in law_categories:
        res = (
            supabase.table("law_chunks")
            .select("id", count="exact")
            .eq("category", cat)
            .execute()
        )
        rows.append(StatsResult(category=cat, count=res.count or 0))
    return rows
