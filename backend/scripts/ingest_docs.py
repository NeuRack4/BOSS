"""
docs/ 폴더의 모든 서식 문서를 Supabase pgvector에 수집하는 CLI 스크립트.

사용법:
  # 전체 docs/ 폴더 수집
  python -m backend.scripts.ingest_docs

  # 특정 파일만 수집
  python -m backend.scripts.ingest_docs --file docs/사업자등록_신청서.pdf

  # docs 폴더 경로 지정
  python -m backend.scripts.ingest_docs --docs-dir ./docs
"""
import argparse
import asyncio
import sys
from pathlib import Path


async def run(docs_dir: str, target_file: str | None) -> None:
    from backend.rag.document_loader import load_document, load_docs_folder
    from backend.rag.ingest import ingest_law_chunks as ingest_documents
    from backend.core.constants import DocumentCategory

    if target_file:
        path = Path(target_file)
        if not path.exists():
            print(f"[오류] 파일을 찾을 수 없습니다: {path}", file=sys.stderr)
            sys.exit(1)
        print(f"\n단일 파일 수집: {path.name}")
        chunks = load_document(path)
        print(f"  → {len(chunks)}개 청크 감지")
    else:
        print(f"\ndocs 폴더 전체 수집: {docs_dir}")
        chunks = load_docs_folder(docs_dir)
        print(f"\n총 {len(chunks)}개 청크 감지")

    if not chunks:
        print("[경고] 수집할 청크가 없습니다.")
        return

    # 카테고리별로 그룹핑하여 ingest
    from itertools import groupby
    chunks_sorted = sorted(chunks, key=lambda x: x["category"])

    total_saved = 0
    for category, group in groupby(chunks_sorted, key=lambda x: x["category"]):
        group_list = list(group)
        # ingest_documents 형식에 맞게 변환 (category 필드 제거)
        docs = [
            {
                "source":      c["source"],
                "chunk_index": c["chunk_index"],
                "content":     c["content"],
                "metadata":    c["metadata"],
            }
            for c in group_list
        ]
        saved = await ingest_documents(docs, DocumentCategory(category))
        total_saved += saved
        print(f"  [{category}] {saved}청크 저장 완료")

    print(f"\n수집 완료: 총 {total_saved}청크가 Supabase pgvector에 저장되었습니다.")


def main() -> None:
    parser = argparse.ArgumentParser(description="BOSS RAG 문서 수집 CLI")
    parser.add_argument(
        "--docs-dir",
        default="docs",
        help="수집할 문서 폴더 경로 (기본값: docs)",
    )
    parser.add_argument(
        "--file",
        default=None,
        help="특정 파일만 수집 (예: docs/사업자등록_신청서.pdf)",
    )
    args = parser.parse_args()
    asyncio.run(run(args.docs_dir, args.file))


if __name__ == "__main__":
    main()
