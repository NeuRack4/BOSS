"""
문서 수집 → 청킹 → 임베딩 → Supabase 저장 파이프라인

청킹 전략:
  법령 문서   → 조항(Article) 단위
  절차 안내   → 단계(Step) 단위
  공고 문서   → 공고 1건 = 1청크
"""
import asyncio
from pathlib import Path
from backend.core.constants import DocumentCategory
from backend.rag.embeddings.bge_embeddings import embed
from backend.db.client import get_supabase


async def ingest_documents(
    documents: list[dict],
    category: DocumentCategory,
    batch_size: int = 20,
) -> int:
    """
    documents: [{"source": str, "chunk_index": int, "content": str, "metadata": dict}]
    반환: 저장된 청크 수
    """
    supabase = get_supabase()
    total = 0

    for i in range(0, len(documents), batch_size):
        batch = documents[i : i + batch_size]
        texts = [d["content"] for d in batch]
        vectors = await embed(texts)

        rows = [
            {
                "category": category,
                "source": d["source"],
                "chunk_index": d["chunk_index"],
                "content": d["content"],
                "embedding": v,
                "metadata": d.get("metadata", {}),
            }
            for d, v in zip(batch, vectors)
        ]

        supabase.table("documents").insert(rows).execute()
        total += len(rows)
        print(f"[ingest] {total + len(rows)}개 저장 완료")

    return total


async def ingest_from_file(
    file_path: str | Path,
    category: DocumentCategory,
    source_name: str,
) -> int:
    """텍스트 파일을 청킹하여 수집"""
    from backend.data.parsers.pdf_parser import parse_pdf, chunk_by_article

    path = Path(file_path)
    if path.suffix == ".pdf":
        text = parse_pdf(path)
    else:
        text = path.read_text(encoding="utf-8")

    chunks = chunk_by_article(text)
    documents = [
        {"source": source_name, "chunk_index": i, "content": chunk, "metadata": {}}
        for i, chunk in enumerate(chunks)
    ]

    return await ingest_documents(documents, category)


async def ingest_regulations() -> int:
    """
    법제처 API에서 규제법령 조문 수집 → Supabase 저장.
    REGULATION_TARGETS에 정의된 법령·조문만 선별 수집합니다.
    """
    from backend.data.crawlers.law_api import fetch_all_regulations

    docs = await fetch_all_regulations()
    if not docs:
        return 0
    return await ingest_documents(docs, DocumentCategory.REGULATION)
