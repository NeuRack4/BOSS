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


async def ingest_law_documents(
    documents: list[dict],
    category: DocumentCategory,
    batch_size: int = 20,
) -> int:
    """
    법령 계층 청크 저장 (article → paragraph 2단계 삽입)

    documents: fetch_regulation() 반환값
      — chunk_type, article_key, paragraph_no, paragraph_char 포함

    흐름:
      1. article 청크 임베딩 → 저장 → DB id 수집
      2. paragraph 청크 임베딩 → parent_doc_id 연결 → 저장
    """
    supabase = get_supabase()

    article_chunks = [d for d in documents if d.get("chunk_type") == "article"]
    para_chunks    = [d for d in documents if d.get("chunk_type") == "paragraph"]

    # ── 1단계: article 청크 저장 ─────────────────────────────────
    article_key_to_id: dict[str, int] = {}
    for i in range(0, len(article_chunks), batch_size):
        batch   = article_chunks[i : i + batch_size]
        vectors = await embed([d["content"] for d in batch])

        rows = [
            {
                "category":       category,
                "source":         d["source"],
                "chunk_index":    d["chunk_index"],
                "content":        d["content"],
                "embedding":      v,
                "chunk_type":     "article",
                "paragraph_no":   None,
                "paragraph_char": None,
                "parent_doc_id":  None,
                "metadata":       d.get("metadata", {}),
            }
            for d, v in zip(batch, vectors)
        ]

        result = supabase.table("documents").insert(rows).execute()
        for chunk, row in zip(batch, result.data):
            article_key_to_id[chunk["article_key"]] = row["id"]

    print(f"[ingest] article 저장: {len(article_chunks)}개")

    # ── 2단계: paragraph 청크 저장 (parent_doc_id 연결) ──────────
    for i in range(0, len(para_chunks), batch_size):
        batch   = para_chunks[i : i + batch_size]
        vectors = await embed([d["content"] for d in batch])

        rows = [
            {
                "category":       category,
                "source":         d["source"],
                "chunk_index":    d["chunk_index"],
                "content":        d["content"],
                "embedding":      v,
                "chunk_type":     "paragraph",
                "paragraph_no":   d.get("paragraph_no"),
                "paragraph_char": d.get("paragraph_char"),
                "parent_doc_id":  article_key_to_id.get(d["article_key"]),
                "metadata":       d.get("metadata", {}),
            }
            for d, v in zip(batch, vectors)
        ]

        supabase.table("documents").insert(rows).execute()

    print(f"[ingest] paragraph 저장: {len(para_chunks)}개")
    total = len(article_chunks) + len(para_chunks)
    print(f"[ingest] 총 {total}개 저장 완료")
    return total


async def ingest_regulations() -> int:
    """
    법제처 API에서 규제법령 조문 수집 → Supabase 저장.
    REGULATION_TARGETS에 정의된 법령·조문만 선별 수집합니다.
    """
    from backend.data.crawlers.law_api import fetch_all_regulations

    docs = await fetch_all_regulations()
    if not docs:
        return 0
    return await ingest_law_documents(docs, DocumentCategory.REGULATION)


async def ingest_tax_laws() -> int:
    """세금 법령 수집 → Supabase 저장"""
    from backend.data.crawlers.law_api import fetch_all_tax_laws

    docs = await fetch_all_tax_laws()
    if not docs:
        return 0
    return await ingest_law_documents(docs, DocumentCategory.TAX)
