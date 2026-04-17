"""
docs/contract_risks/*.md 파일을 읽어 pattern_contract_knowledge_chunks 테이블에 수집하는 CLI 스크립트.

청킹 전략:
  각 '### 패턴 N:' 블록 단위로 1청크 (위험 조항 패턴 1개 = 1청크)

전용 컬럼:
  risk_level     — 'High' | 'Mid' | 'Low'  (B-tree pre-filter용 독립 컬럼)
  pattern_name   — 패턴 이름 (예: "포괄임금제 과도 적용 조항")
  contract_type  — 계약서 유형 (category와 동일값, pre-filter 편의용)

멱등성:
  source + chunk_index unique 제약 기반 upsert

사용법:
  # 전체 docs/contract_risks/ 폴더 수집
  python -m backend.scripts.ingest_contract_risks

  # 특정 파일만 수집
  python -m backend.scripts.ingest_contract_risks --file docs/contract_risks/labor_contract.md

  # 폴더 경로 직접 지정
  python -m backend.scripts.ingest_contract_risks --risks-dir path/to/dir
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path

_TABLE = "pattern_contract_knowledge_chunks"

_CATEGORY_MAP = {
    "labor_contract":       "labor",
    "lease_contract":       "lease",
    "service_contract":     "service",
    "franchise_contract":   "franchise",
    "supply_contract":      "supply",
    "partnership_contract": "partnership",
}

_RISK_LEVEL_PATTERN = re.compile(
    r"(?:risk[_\s]?level|위험도|위험\s*등급)\*{0,2}\s*[:：]\s*(High|Mid|Low|높음|중간|낮음)",
    re.IGNORECASE,
)

_PATTERN_HEADER = re.compile(
    r"^#{1,4}\s*패턴\s*\d+\s*[:：]?\s*(.+)$",
    re.MULTILINE,
)


def _extract_category(stem: str) -> str:
    if stem in _CATEGORY_MAP:
        return _CATEGORY_MAP[stem]
    for key, val in _CATEGORY_MAP.items():
        if stem.startswith(key):
            return val
    return "contract"


def _extract_risk_level(text: str) -> str | None:
    match = _RISK_LEVEL_PATTERN.search(text)
    if not match:
        return None
    raw = match.group(1).strip()
    _normalize = {"높음": "High", "중간": "Mid", "낮음": "Low"}
    normalized = _normalize.get(raw, raw.capitalize())
    # Mid-High 같은 복합값은 더 심한 쪽으로
    if "-" in normalized or "/" in normalized:
        return "High" if "high" in normalized.lower() else "Mid"
    return normalized if normalized in ("High", "Mid", "Low") else None


def _chunk_md_by_pattern(content: str) -> list[dict]:
    """마크다운 내용을 '### 패턴 N:' 블록 단위로 청킹."""
    matches = list(_PATTERN_HEADER.finditer(content))
    if not matches:
        return [{"pattern_name": "전체", "content": content.strip()}]

    chunks: list[dict] = []
    for i, match in enumerate(matches):
        start = match.start()
        end   = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        block = content[start:end].strip()
        chunks.append({"pattern_name": match.group(1).strip(), "content": block})

    return chunks


def _build_chunks(md_path: Path) -> list[dict]:
    """
    .md 파일 1개 → pattern_contract_knowledge_chunks 삽입용 dict 리스트.

    반환 형식:
      {
        "source":        str,   # 파일명
        "category":      str,
        "contract_type": str,   # = category
        "chunk_index":   int,
        "risk_level":    str | None,   # 'High' | 'Mid' | 'Low'
        "pattern_name":  str,
        "content":       str,
        "metadata":      dict,
      }
    """
    try:
        text = md_path.read_text(encoding="utf-8")
    except Exception as exc:
        print(f"[경고] 파일 읽기 실패 — {md_path.name}: {exc}")
        return []

    category      = _extract_category(md_path.stem)
    raw_chunks    = _chunk_md_by_pattern(text)

    result: list[dict] = []
    for idx, rc in enumerate(raw_chunks):
        risk_level = _extract_risk_level(rc["content"])
        result.append({
            "source":        md_path.name,
            "category":      category,
            "contract_type": category,
            "chunk_index":   idx,
            "risk_level":    risk_level,
            "pattern_name":  rc["pattern_name"],
            "content":       rc["content"],
            "metadata": {
                "risk_level":    risk_level,
                "pattern_name":  rc["pattern_name"],
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
        print(
            f"[경고] BGE-M3 임베딩 실패 ({bge_err}). "
            "OpenAI text-embedding-3-small로 폴백합니다. "
            "⚠️  벡터 컬럼(1024차원)과 차원 불일치로 저장이 실패할 수 있습니다."
        )
        from backend.rag.embeddings.openai_embeddings import embed as oai_embed
        return await oai_embed(texts)


async def _upsert_chunks(chunks: list[dict], batch_size: int = 8) -> int:
    """
    pattern_contract_knowledge_chunks 테이블에 upsert.
    source + chunk_index unique 제약 기반 멱등성 보장.
    risk_level / pattern_name / contract_type을 전용 컬럼으로 저장.
    """
    from backend.db.client import get_supabase
    supabase = get_supabase()
    total = 0

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        texts = [c["content"] for c in batch]

        try:
            vectors = await _embed_with_fallback(texts)
        except Exception as exc:
            print(f"[오류] 임베딩 실패 (batch {i}~{i + len(batch) - 1}), skip: {exc}")
            continue

        rows = [
            {
                "source":        c["source"],
                "category":      c["category"],
                "contract_type": c["contract_type"],
                "chunk_index":   c["chunk_index"],
                "risk_level":    c["risk_level"],       # 전용 컬럼 (pre-filter용)
                "pattern_name":  c["pattern_name"],     # 전용 컬럼
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
            print(f"  [{batch[0]['source']}] {total}청크 upsert 완료")
        except Exception as exc:
            print(f"[오류] DB 저장 실패 (batch {i}~{i + len(batch) - 1}), skip: {exc}")

    return total


async def run(risks_dir: str, target_file: str | None) -> None:
    if target_file:
        path = Path(target_file)
        if not path.exists():
            print(f"[오류] 파일을 찾을 수 없습니다: {path}", file=sys.stderr)
            sys.exit(1)
        md_files = [path]
        print(f"\n단일 파일 수집: {path.name} → {_TABLE}")
    else:
        dir_path = Path(risks_dir)
        if not dir_path.exists():
            print(f"[오류] 폴더를 찾을 수 없습니다: {dir_path}", file=sys.stderr)
            sys.exit(1)
        md_files = sorted(dir_path.glob("*.md"))
        if not md_files:
            print(f"[경고] {risks_dir} 폴더에 .md 파일이 없습니다.")
            return
        print(f"\n{risks_dir} folder: {len(md_files)} files -> {_TABLE}")

    total_saved = 0
    for md_file in md_files:
        print(f"\n[처리] {md_file.name}")
        chunks = _build_chunks(md_file)
        if not chunks:
            print(f"  → 청크 없음, skip")
            continue
        print(
            f"  → {len(chunks)}개 청크 (category: {chunks[0]['category']}, "
            f"risk_levels: {set(c['risk_level'] for c in chunks if c['risk_level'])})"
        )
        saved = await _upsert_chunks(chunks)
        total_saved += saved
        print(f"  → {saved}청크 저장 완료")

    print(f"\n수집 완료: 총 {total_saved}청크가 {_TABLE}에 저장되었습니다.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=f"서류 검토 위험 조항 패턴 수집 CLI ({_TABLE})"
    )
    parser.add_argument(
        "--risks-dir",
        default="docs/contract_risks",
        help="수집할 .md 파일 폴더 경로 (기본값: docs/contract_risks)",
    )
    parser.add_argument(
        "--file",
        default=None,
        help="특정 파일만 수집 (예: docs/contract_risks/labor_contract.md)",
    )
    args = parser.parse_args()
    asyncio.run(run(args.risks_dir, args.file))


if __name__ == "__main__":
    main()
