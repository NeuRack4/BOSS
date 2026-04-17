"""
법제처 Open API에서 서류 검토용 법령 조문을 수집 → 임베딩 → law_contract_knowledge_chunks 저장.

청킹: 2단계 계층 청킹 (law_chunks와 동일 방식)
  - article 청크: 조문 전체 텍스트 (parent)
  - paragraph 청크: 항 단위 (children, parent_doc_id로 article과 연결)
저장 순서: article 먼저 삽입 → DB id 수거 → paragraph에 parent_doc_id 세팅 후 삽입

metadata:
  article 청크: {"law_name", "article", "article_title", "topic", "lsi_seq", "category", "chunk_type"}
  paragraph 청크: 위 + {"paragraph_no", "paragraph_char"}

멱등성: source 기준 전체 삭제 후 재삽입 (delete + insert)

사용법:
  # 전체 TARGET_LAWS 수집
  python -m backend.scripts.ingest_contract_laws

  # 특정 법령만 수집
  python -m backend.scripts.ingest_contract_laws --law "근로기준법"

  # 기존 데이터 삭제 후 재수집
  python -m backend.scripts.ingest_contract_laws --reset
"""
import argparse
import asyncio
import re
import sys

import httpx

_BASE_URL = "https://www.law.go.kr/DRF"
_OC = "kimjaehyun9605"

TARGET_LAWS = [
    {"name": "근로기준법",                      "category": "labor",   "topic": "labor_standard"},
    {"name": "최저임금법",                      "category": "labor",   "topic": "minimum_wage"},
    {"name": "상가건물 임대차보호법",            "category": "lease",   "topic": "commercial_lease"},
    {"name": "주택임대차보호법",                "category": "lease",   "topic": "residential_lease"},
    {"name": "하도급거래 공정화에 관한 법률",    "category": "supply",  "topic": "subcontract_fair"},
    {"name": "약관의 규제에 관한 법률",          "category": "service", "topic": "standard_terms"},
    {"name": "민법",                            "category": "civil",   "topic": "civil_contract"},
]

# 민법은 계약 관련 조문만 수집
_MINBEOP_ARTICLE_RANGE = range(527, 734)

_TABLE = "law_contract_knowledge_chunks"


def _parse_article_no(jo_no: str) -> int | None:
    try:
        return int(jo_no)
    except (ValueError, TypeError):
        return None


def _to_str(value) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return " ".join(_to_str(v) for v in value)
    if isinstance(value, dict):
        return " ".join(_to_str(v) for v in value.values())
    return str(value)


def _build_hang_content(hang: dict) -> str:
    """항 dict → 항내용 + 호 + 목 전체 텍스트"""
    hang_text = _to_str(hang.get("항내용") or hang.get("조문내용", ""))
    parts = [hang_text]

    ho_list = hang.get("호", [])
    if isinstance(ho_list, dict):
        ho_list = [ho_list]
    for ho in ho_list:
        ho_text = _to_str(ho.get("호내용", ""))
        if ho_text:
            parts.append(f"  {ho_text}")
        mok_list = ho.get("목", [])
        if isinstance(mok_list, dict):
            mok_list = [mok_list]
        for mok in mok_list:
            mok_text = _to_str(mok.get("목내용", ""))
            if mok_text:
                parts.append(f"    {mok_text}")

    return "\n".join(p for p in parts if p)


async def _search_lsi_seq(name: str, client: httpx.AsyncClient) -> str | None:
    try:
        resp = await client.get(
            f"{_BASE_URL}/lawSearch.do",
            params={"OC": _OC, "target": "law", "type": "JSON", "query": name, "display": 1, "page": 1},
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        print(f"[오류] 법령 검색 실패 ({name}): {exc}")
        return None

    search_result = data.get("LawSearch", {})
    law = search_result.get("law") or search_result.get("법령")
    if not law:
        return None
    if isinstance(law, list):
        law = law[0]
    return law.get("법령일련번호") or law.get("lsiSeq")


async def _fetch_articles(lsi_seq: str, client: httpx.AsyncClient) -> list[dict]:
    try:
        resp = await client.get(
            f"{_BASE_URL}/lawService.do",
            params={"OC": _OC, "target": "law", "type": "JSON", "MST": lsi_seq},
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        print(f"[오류] 조문 수집 실패 (lsiSeq={lsi_seq}): {exc}")
        return []

    law_data = data.get("법령", {})
    units = law_data.get("조문", {}).get("조문단위", [])
    if isinstance(units, dict):
        units = [units]
    return units


def _parse_article_hierarchical(unit: dict, target: dict, lsi_seq: str) -> list[dict]:
    """
    조문단위 → [article_chunk, ...paragraph_chunks]

    article_key 필드는 Python 내부 연결용 (DB 저장 안 함).
    chunk_type: 'article' | 'paragraph'
    """
    if unit.get("조문여부") != "조문":
        return []

    jo_no = unit.get("조문번호", "")
    if not jo_no or not str(jo_no).isdigit():
        return []

    law_name = target["name"]
    if law_name == "민법":
        article_int = _parse_article_no(str(jo_no))
        if article_int is None or article_int not in _MINBEOP_ARTICLE_RANGE:
            return []

    jo_title = unit.get("조문제목", "")
    jo_key   = unit.get("조문키", jo_no)
    article_name  = f"제{int(jo_no)}조"
    article_label = f"{article_name}({jo_title})" if jo_title else article_name
    article_key   = f"{law_name}-{jo_key}"  # in-memory 연결키 (DB 미저장)

    hang_list = unit.get("항", [])
    if isinstance(hang_list, dict):
        hang_list = [hang_list]

    base_meta = {
        "law_name":      law_name,
        "article":       article_name,
        "article_title": jo_title,
        "topic":         target["topic"],
        "lsi_seq":       lsi_seq,
        "category":      target["category"],
    }

    chunks: list[dict] = []

    # 항이 없는 단문 조문 → article 청크만
    if not hang_list:
        chunks.append({
            "article_key":   article_key,
            "source":        law_name,
            "chunk_type":    "article",
            "paragraph_no":  None,
            "paragraph_char": None,
            "content":       article_label,
            "metadata":      {**base_meta, "chunk_type": "article"},
        })
        return chunks

    # article 청크 (parent): 전체 항을 합쳐 하나로
    all_hang_texts  = [_build_hang_content(h) for h in hang_list]
    article_content = f"[{law_name} {article_label}]\n\n" + "\n\n".join(all_hang_texts)
    chunks.append({
        "article_key":    article_key,
        "source":         law_name,
        "chunk_type":     "article",
        "paragraph_no":   None,
        "paragraph_char": None,
        "content":        article_content.strip(),
        "metadata":       {**base_meta, "chunk_type": "article"},
    })

    # paragraph 청크 (children): 항 단위 정밀 검색용
    for idx, hang in enumerate(hang_list, 1):
        hang_char = hang.get("항번호", "①")
        hang_text = _build_hang_content(hang)
        if not hang_text.strip():
            continue
        content = f"[{law_name} {article_label} {hang_char}]\n{hang_text}"
        chunks.append({
            "article_key":    article_key,
            "source":         law_name,
            "chunk_type":     "paragraph",
            "paragraph_no":   idx,
            "paragraph_char": hang_char,
            "content":        content.strip(),
            "metadata":       {
                **base_meta,
                "chunk_type":     "paragraph",
                "paragraph_no":   idx,
                "paragraph_char": hang_char,
            },
        })

    return chunks


async def _fetch_law_chunks(target: dict) -> list[dict]:
    law_name = target["name"]
    print(f"  [{law_name}] 법령일련번호 조회 중...")

    async with httpx.AsyncClient(timeout=20.0) as client:
        lsi_seq = await _search_lsi_seq(law_name, client)
        if not lsi_seq:
            print(f"  [{law_name}] 법령일련번호를 찾을 수 없습니다. skip")
            return []

        await asyncio.sleep(0.3)
        print(f"  [{law_name}] 조문 수집 중 (lsiSeq={lsi_seq})...")
        units = await _fetch_articles(lsi_seq, client)

    if not units:
        print(f"  [{law_name}] 조문이 없습니다. skip")
        return []

    chunks: list[dict] = []
    for unit in units:
        try:
            parsed = _parse_article_hierarchical(unit, target, lsi_seq)
        except Exception as exc:
            print(f"  [{law_name}] 조문 파싱 실패, skip: {exc}")
            continue
        chunks.extend(parsed)

    articles   = sum(1 for c in chunks if c["chunk_type"] == "article")
    paragraphs = sum(1 for c in chunks if c["chunk_type"] == "paragraph")
    print(f"  [{law_name}] → article {articles}개 + paragraph {paragraphs}개 준비")
    return chunks


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


async def _save_chunks(chunks: list[dict], category: str, batch_size: int = 8) -> int:
    """
    2단계 삽입:
      Pass 1 — article 청크 삽입 → DB id 수거 → article_key → id 맵 구성
      Pass 2 — paragraph 청크 삽입 (parent_doc_id 세팅)
    """
    from backend.db.client import get_supabase
    supabase = get_supabase()

    articles   = [c for c in chunks if c["chunk_type"] == "article"]
    paragraphs = [c for c in chunks if c["chunk_type"] == "paragraph"]

    # 기존 데이터 전체 삭제 (멱등성)
    if chunks:
        source = chunks[0]["source"]
        print(f"  [{source}] 기존 데이터 삭제 중...")
        supabase.table(_TABLE).delete().eq("source", source).execute()

    # ── Pass 1: article 삽입 ──────────────────────────────────────────────────
    article_key_to_id: dict[str, int] = {}

    for i in range(0, len(articles), batch_size):
        batch = articles[i : i + batch_size]
        texts = [c["content"] for c in batch]
        try:
            vectors = await _embed_with_fallback(texts)
        except Exception as exc:
            print(f"[오류] article 임베딩 실패 (batch {i}), skip: {exc}")
            continue

        rows = [
            {
                "source":        c["source"],
                "category":      category,
                "chunk_index":   i + j,
                "chunk_type":    "article",
                "paragraph_no":  None,
                "paragraph_char": None,
                "parent_doc_id": None,
                "content":       c["content"],
                "embedding":     v,
                "metadata":      c["metadata"],
            }
            for j, (c, v) in enumerate(zip(batch, vectors))
        ]

        try:
            result = supabase.table(_TABLE).insert(rows).execute()
            for j, row_data in enumerate(result.data or []):
                article_key_to_id[batch[j]["article_key"]] = row_data["id"]
            print(f"  [{batch[0]['source']}] article {len(article_key_to_id)}개 저장")
        except Exception as exc:
            print(f"[오류] article DB 저장 실패 (batch {i}), skip: {exc}")

    # ── Pass 2: paragraph 삽입 (parent_doc_id 연결) ───────────────────────────
    para_saved = 0
    para_offset = len(articles)  # chunk_index 충돌 방지

    for i in range(0, len(paragraphs), batch_size):
        batch = paragraphs[i : i + batch_size]
        texts = [c["content"] for c in batch]
        try:
            vectors = await _embed_with_fallback(texts)
        except Exception as exc:
            print(f"[오류] paragraph 임베딩 실패 (batch {i}), skip: {exc}")
            continue

        rows = [
            {
                "source":         c["source"],
                "category":       category,
                "chunk_index":    para_offset + i + j,
                "chunk_type":     "paragraph",
                "paragraph_no":   c["paragraph_no"],
                "paragraph_char": c["paragraph_char"],
                "parent_doc_id":  article_key_to_id.get(c["article_key"]),
                "content":        c["content"],
                "embedding":      v,
                "metadata":       c["metadata"],
            }
            for j, (c, v) in enumerate(zip(batch, vectors))
        ]

        try:
            supabase.table(_TABLE).insert(rows).execute()
            para_saved += len(rows)
            print(f"  [{batch[0]['source']}] paragraph {para_saved}개 저장")
        except Exception as exc:
            print(f"[오류] paragraph DB 저장 실패 (batch {i}), skip: {exc}")

    return len(article_key_to_id) + para_saved


async def run(law_name: str | None, reset: bool) -> None:
    targets = TARGET_LAWS
    if law_name:
        targets = [t for t in TARGET_LAWS if t["name"] == law_name]
        if not targets:
            names = [t["name"] for t in TARGET_LAWS]
            print(f"[오류] '{law_name}'은 수집 대상이 아닙니다.", file=sys.stderr)
            print(f"선택 가능: {', '.join(names)}", file=sys.stderr)
            sys.exit(1)

    if reset:
        from backend.db.client import get_supabase
        supabase = get_supabase()
        for t in targets:
            print(f"[reset] {_TABLE} — '{t['name']}' 기존 데이터 삭제")
            supabase.table(_TABLE).delete().eq("source", t["name"]).execute()

    print(f"\n수집 대상: {len(targets)}개 법령 → {_TABLE} (2단계 계층 청킹)")
    total_saved = 0

    for target in targets:
        print(f"\n[{target['name']}] 수집 시작")
        chunks = await _fetch_law_chunks(target)
        if not chunks:
            continue

        saved = await _save_chunks(chunks, category=target["category"])
        total_saved += saved
        print(f"[{target['name']}] saved {saved} chunks (article+paragraph)")

        await asyncio.sleep(0.5)

    print(f"\n수집 완료: 총 {total_saved}청크가 {_TABLE}에 저장되었습니다.")


def main() -> None:
    law_names = [t["name"] for t in TARGET_LAWS]
    parser = argparse.ArgumentParser(
        description=f"서류 검토용 법령 조문 수집 CLI ({_TABLE})"
    )
    parser.add_argument(
        "--law",
        choices=law_names,
        default=None,
        metavar="LAW_NAME",
        help=f"수집할 법령명 (생략 시 전체). 선택 가능: {', '.join(law_names)}",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        default=False,
        help="수집 전 해당 법령의 기존 데이터를 삭제하고 재수집",
    )
    args = parser.parse_args()
    asyncio.run(run(args.law, args.reset))


if __name__ == "__main__":
    main()
