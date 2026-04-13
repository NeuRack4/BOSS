"""
RAG 관련 API 엔드포인트

POST /rag/ingest/all    — docs/ 폴더 전체 수집 (관리자용)
POST /rag/ingest/file   — 특정 파일 수집 (관리자용)
POST /rag/search        — 유사도 검색
GET  /rag/stats         — 카테고리별 저장 문서 수 조회
"""
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.core.constants import DocumentCategory, LEGAL_DISCLAIMER
from backend.rag.document_loader import load_document, load_docs_folder
from backend.rag.ingest import ingest_documents
from backend.rag.retriever.pgvector_retriever import retrieve
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
        total += await ingest_documents(docs, DocumentCategory(category))

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
    saved = await ingest_documents(docs, category)

    return IngestResult(
        saved_chunks=saved,
        message=f"[{path.name}] → {saved}청크 저장 완료 (카테고리: {category})",
    )


@router.post("/search", response_model=list[SearchResult], summary="RAG 유사도 검색")
async def search(req: SearchRequest):
    """
    쿼리를 임베딩하여 Supabase pgvector에서 유사한 문서 청크를 반환.
    사업자등록·영업신고 절차 조회, 서식 내용 질의 등에 사용.
    """
    results = await retrieve(
        query=req.query,
        category=req.category,
        match_count=req.match_count,
        match_threshold=req.match_threshold,
    )
    return [SearchResult(**r, disclaimer=LEGAL_DISCLAIMER) for r in results]


@router.get("/stats", response_model=list[StatsResult], summary="카테고리별 문서 수 조회")
async def stats():
    """pgvector documents 테이블의 카테고리별 청크 수를 반환."""
    supabase = get_supabase()
    result = supabase.rpc("count_documents_by_category", {}).execute()

    if not result.data:
        # RPC가 없을 경우 fallback: 카테고리 목록 순회
        rows = []
        for cat in DocumentCategory:
            res = (
                supabase.table("documents")
                .select("id", count="exact")
                .eq("category", cat)
                .execute()
            )
            rows.append(StatsResult(category=cat, count=res.count or 0))
        return rows

    return [StatsResult(category=r["category"], count=r["count"]) for r in result.data]
