"""
docs/ 폴더 문서를 RAG 파이프라인으로 로드하는 스마트 로더.

카테고리 감지 우선순위:
  1. 상위 폴더명  (창업/ 운영/ 채용/ 폐업/)
  2. 파일명 키워드

폴더 → 카테고리 매핑:
  창업/   → license  (사업자등록, 식품영업신고, 임대차계약)
  운영/   → license  (변경신청, 재발급)
  채용/   → labor    (근로계약서)
  폐업/   → license  (폐업신고)

파일명 키워드 (폴더 감지 실패 시 fallback):
  사업자등록*, 영업신고*, 식품영업*, 휴게음식점*  → license + form
  임대차*, 임대*                                 → lease   + form
  근로계약*, 고용*, 노동*                        → labor   + form
  부가세*, 세금*, 소득세*, 원천세*               → tax     + step
  지원사업*, 공고*, 기업마당*                    → subsidy + article
  식품위생법*, 법령*, 시행규칙*                  → license + article
"""
from pathlib import Path

from backend.core.constants import DocumentCategory
from backend.data.parsers.pdf_parser import (
    parse_pdf,
    parse_markdown,
    chunk_by_article,
    chunk_by_form_section,
    chunk_by_markdown_heading,
    chunk_by_step,
)

# 폴더명 → (카테고리, 청킹 전략)
_FOLDER_RULES: dict[str, tuple[DocumentCategory, str]] = {
    "창업":  (DocumentCategory.LICENSE, "form"),
    "운영":  (DocumentCategory.LICENSE, "form"),
    "채용":  (DocumentCategory.LABOR,   "form"),
    "폐업":  (DocumentCategory.LICENSE, "form"),
}

# 파일명 키워드 → (카테고리, 청킹 전략)
_FILENAME_RULES: list[tuple[list[str], DocumentCategory, str]] = [
    (["사업자등록", "사업자_등록"],                              DocumentCategory.LICENSE,  "form"),
    (["영업신고", "식품영업", "휴게음식점", "일반음식점", "제과점", "영업등록", "영업허가"],
                                                               DocumentCategory.LICENSE,  "form"),
    (["임대차", "임대_", "lease"],                              DocumentCategory.LEASE,    "form"),
    (["근로계약", "고용", "노동", "labor"],                     DocumentCategory.LABOR,    "form"),
    (["부가세", "세금", "소득세", "원천세", "tax"],             DocumentCategory.TAX,      "step"),
    (["지원사업", "공고", "기업마당", "subsidy"],               DocumentCategory.SUBSIDY,  "article"),
    (["식품위생법", "법령", "시행규칙"],                        DocumentCategory.LICENSE,  "article"),
    (["폐업", "말소"],                                         DocumentCategory.LICENSE,  "form"),
]

_CHUNK_FN = {
    "form":    chunk_by_form_section,
    "article": chunk_by_article,
    "step":    chunk_by_step,
    "md":      chunk_by_markdown_heading,
}


def _detect_category_and_strategy(
    filename: str,
    parent_folder: str | None = None,
) -> tuple[DocumentCategory, str]:
    """
    카테고리·청킹 전략 감지 우선순위:
      1. 파일명 키워드 (구체적일수록 신뢰도 높음 — lease/labor 등 강한 신호)
      2. 폴더명 (애매한 파일명의 fallback)
      3. 기본값 license/form
    """
    # 1순위: 파일명 키워드
    name_lower = filename.lower()
    for keywords, category, strategy in _FILENAME_RULES:
        if any(kw in name_lower for kw in keywords):
            return category, strategy

    # 2순위: 폴더명
    if parent_folder and parent_folder in _FOLDER_RULES:
        return _FOLDER_RULES[parent_folder]

    return DocumentCategory.LICENSE, "form"  # 기본값


def _build_metadata(
    category: DocumentCategory,
    strategy: str,
    filename: str,
    folder: str | None,
) -> dict:
    doc_type = "form" if strategy == "form" else "law" if strategy == "article" else "guide"
    return {
        "doc_type":          doc_type,
        "original_filename": filename,
        "folder":            folder or "root",
        "business_type":     ["cafe", "bakery", "snack"],
    }


def load_document(file_path: str | Path) -> list[dict]:
    """
    단일 파일을 로드하여 RAG ingest용 청크 리스트로 변환.

    반환:
        [{"source", "chunk_index", "content", "metadata", "category"}]
    """
    path = Path(file_path)
    filename = path.name
    suffix   = path.suffix.lower()
    parent_folder = path.parent.name if path.parent.name != "docs" else None

    category, strategy = _detect_category_and_strategy(filename, parent_folder)

    # 파일 파싱
    if suffix == ".pdf":
        text     = parse_pdf(path)
        chunk_fn = _CHUNK_FN.get(strategy, chunk_by_form_section)
    elif suffix in (".md", ".txt"):
        text     = parse_markdown(path)
        chunk_fn = _CHUNK_FN["md"] if strategy != "article" else chunk_by_article
    else:
        raise ValueError(f"지원하지 않는 파일 형식: {suffix} ({filename})")

    chunks   = chunk_fn(text)
    metadata = _build_metadata(category, strategy, filename, parent_folder)
    source   = path.stem

    return [
        {
            "source":      source,
            "chunk_index": i,
            "content":     chunk,
            "metadata":    metadata,
            "category":    category,
        }
        for i, chunk in enumerate(chunks)
        if chunk.strip()
    ]


def load_docs_folder(docs_dir: str | Path = "docs") -> list[dict]:
    """
    docs/ 폴더와 하위 폴더의 모든 .pdf / .md / .txt 파일을 재귀 로드.
    """
    docs_path = Path(docs_dir)
    if not docs_path.exists():
        raise FileNotFoundError(f"docs 폴더를 찾을 수 없습니다: {docs_path.resolve()}")

    supported    = {".pdf", ".md", ".txt"}
    all_chunks: list[dict] = []

    for file_path in sorted(docs_path.rglob("*")):
        if file_path.is_dir() or file_path.suffix.lower() not in supported:
            continue
        chunks = load_document(file_path)
        folder = file_path.parent.name
        print(
            f"  [{folder}/{file_path.name}]"
            f" → {len(chunks)}청크"
            f" / {chunks[0]['category'] if chunks else '-'}"
        )
        all_chunks.extend(chunks)

    return all_chunks
