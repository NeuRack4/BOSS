"""
docs/contract_acceptable/*.md 파일을 읽어 acceptable_contract_knowledge_chunks 테이블에 수집하는 CLI 스크립트.

청킹 전략:
  각 '### 허용패턴 N:' 블록 단위로 1청크

전용 컬럼:
  clause_name   — 허용 조항 이름
  legal_basis   — 법적 근거 요약 (첫 번째 허용 근거 줄에서 추출)
  contract_type — 계약서 유형 (pre-filter용)

멱등성:
  source + chunk_index unique 제약 기반 upsert

사용법:
  python -m backend.scripts.ingest_contract_acceptable
  python -m backend.scripts.ingest_contract_acceptable --file docs/contract_acceptable/labor_contract.md
  python -m backend.scripts.ingest_contract_acceptable --dir path/to/dir
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path

_TABLE = "acceptable_contract_knowledge_chunks"

_CATEGORY_MAP = {
    "labor_contract":       "labor",
    "lease_contract":       "lease",
    "service_contract":     "service",
    "franchise_contract":   "franchise",
    "supply_contract":      "supply",
    "partnership_contract": "partnership",
}

_PATTERN_HEADER = re.compile(
    r"^#{1,4}\s*허용패턴\s*\d+\s*[:：]?\s*(.+)$",
    re.MULTILINE,
)

_LEGAL_BASIS_LINE = re.compile(
    r"\*{0,2}허용\s*근거\*{0,2}\s*[:：]\s*(.+)",
)


def _extract_category(stem: str) -> str:
    if stem in _CATEGORY_MAP:
        return _CATEGORY_MAP[stem]
    for key, val in _CATEGORY_MAP.items():
        if stem.startswith(key):
            return val
    return "contract"


def _extract_legal_basis(text: str) -> str | None:
    match = _LEGAL_BASIS_LINE.search(text)
    if not match:
        return None
    return match.group(1).strip()[:200]


def _chunk_md_by_pattern(content: str) -> list[dict]:
    matches = list(_PATTERN_HEADER.finditer(content))
    if not matches:
        return [{"clause_name": "전체", "content": content.strip()}]

    chunks: list[dict] = []
    for i, match in enumerate(matches):
        start = match.start()
        end   = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        block = content[start:end].strip()
        chunks.append({"clause_name": match.group(1).strip(), "content": block})

    return chunks


def _build_chunks(md_path: Path) -> list[dict]:
    try:
        text = md_path.read_text(encoding="utf-8")
    except Exception as exc:
        print(f"[warning] read failed: {md_path.name}: {exc}")
        return []

    category   = _extract_category(md_path.stem)
    raw_chunks = _chunk_md_by_pattern(text)

    result: list[dict] = []
    for idx, rc in enumerate(raw_chunks):
        legal_basis = _extract_legal_basis(rc["content"])
        result.append({
            "source":        md_path.name,
            "category":      category,
            "contract_type": category,
            "chunk_index":   idx,
            "clause_name":   rc["clause_name"],
            "legal_basis":   legal_basis,
            "content":       rc["content"],
            "metadata": {
                "clause_name":   rc["clause_name"],
                "legal_basis":   legal_basis,
                "contract_type": category,
                "file":          md_path.name,
            },
        })

    return result


async def _embed_with_fallback(texts: list[str]) -> list[list[float]]:
    try:
        from backend.rag.embeddings.bge_embeddings import embed
        return await embed(texts)
    except Exception as bge_err:
        print(f"[warning] BGE-M3 failed ({bge_err}), falling back to OpenAI.")
        from backend.rag.embeddings.openai_embeddings import embed as oai_embed
        return await oai_embed(texts)


async def _upsert_chunks(chunks: list[dict], batch_size: int = 8) -> int:
    from backend.db.client import get_supabase
    supabase = get_supabase()
    total = 0

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        texts = [c["content"] for c in batch]

        try:
            vectors = await _embed_with_fallback(texts)
        except Exception as exc:
            print(f"[error] embedding failed (batch {i}~{i+len(batch)-1}), skip: {exc}")
            continue

        rows = [
            {
                "source":        c["source"],
                "category":      c["category"],
                "contract_type": c["contract_type"],
                "chunk_index":   c["chunk_index"],
                "clause_name":   c["clause_name"],
                "legal_basis":   c["legal_basis"],
                "content":       c["content"],
                "embedding":     v,
                "metadata":      c["metadata"],
            }
            for c, v in zip(batch, vectors)
        ]

        try:
            supabase.table(_TABLE).upsert(
                rows,
                on_conflict="source,chunk_index",
            ).execute()
            total += len(rows)
            print(f"  [{batch[0]['source']}] {total} chunks upserted")
        except Exception as exc:
            print(f"[error] DB save failed (batch {i}~{i+len(batch)-1}), skip: {exc}")

    return total


async def run(acceptable_dir: str, target_file: str | None) -> None:
    if target_file:
        path = Path(target_file)
        if not path.exists():
            print(f"[error] file not found: {path}", file=sys.stderr)
            sys.exit(1)
        md_files = [path]
        print(f"\nsingle file: {path.name} -> {_TABLE}")
    else:
        dir_path = Path(acceptable_dir)
        if not dir_path.exists():
            print(f"[error] directory not found: {dir_path}", file=sys.stderr)
            sys.exit(1)
        md_files = sorted(dir_path.glob("*.md"))
        if not md_files:
            print(f"[warning] no .md files in {acceptable_dir}")
            return
        print(f"\n{acceptable_dir}: {len(md_files)} files -> {_TABLE}")

    total_saved = 0
    for md_file in md_files:
        print(f"\n[processing] {md_file.name}")
        chunks = _build_chunks(md_file)
        if not chunks:
            print("  -> no chunks, skip")
            continue
        print(f"  -> {len(chunks)} chunks (category: {chunks[0]['category']})")
        saved = await _upsert_chunks(chunks)
        total_saved += saved
        print(f"  -> {saved} chunks saved")

    print(f"\ndone: {total_saved} chunks -> {_TABLE}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=f"관행적 허용 조항 지식 수집 CLI ({_TABLE})"
    )
    parser.add_argument(
        "--dir",
        default="docs/contract_acceptable",
        help="수집할 .md 파일 폴더 경로 (기본값: docs/contract_acceptable)",
    )
    parser.add_argument(
        "--file",
        default=None,
        help="특정 파일만 수집",
    )
    args = parser.parse_args()
    asyncio.run(run(args.dir, args.file))


if __name__ == "__main__":
    main()
