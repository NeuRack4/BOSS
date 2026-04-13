"""
docs/ 폴더 문서를 RAG 파이프라인으로 로드하는 스마트 로더.

파일명 기반으로 카테고리와 청킹 전략을 자동 감지:
  사업자등록*, 영업신고*, 식품영업*, 휴게음식점*  → license  + form_section
  임대차*, 임대*                                  → lease    + form_section
  근로계약*, 고용*, 노동*                         → labor    + form_section
  부가세*, 세금*, 소득세*, 원천세*                → tax      + step
  지원사업*, 공고*, 기업마당*                     → subsidy  + article
  식품위생법*, 법령*, 법*                         → license  + article (법령 원문)
  그 외                                           → license  + form_section (기본값)
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

# (파일명 키워드, 카테고리, 청킹 전략)
_FILENAME_RULES: list[tuple[list[str], DocumentCategory, str]] = [
    (["사업자등록", "사업자_등록", "biz_reg"],          DocumentCategory.LICENSE,  "form"),
    (["영업신고", "식품영업", "휴게음식점", "일반음식점", "제과점"], DocumentCategory.LICENSE, "form"),
    (["임대차", "임대_", "lease"],                       DocumentCategory.LEASE,    "form"),
    (["근로계약", "고용", "노동", "labor"],               DocumentCategory.LABOR,    "form"),
    (["부가세", "세금", "소득세", "원천세", "tax"],       DocumentCategory.TAX,      "step"),
    (["지원사업", "공고", "기업마당", "subsidy"],         DocumentCategory.SUBSIDY,  "article"),
    (["식품위생법", "법령", "시행규칙"],                  DocumentCategory.LICENSE,  "article"),
]

_CHUNK_FN = {
    "form":    chunk_by_form_section,
    "article": chunk_by_article,
    "step":    chunk_by_step,
    "md":      chunk_by_markdown_heading,
}


def _detect_category_and_strategy(filename: str) -> tuple[DocumentCategory, str]:
    """파일명에서 카테고리와 청킹 전략을 감지"""
    name_lower = filename.lower()

    for keywords, category, strategy in _FILENAME_RULES:
        if any(kw in name_lower for kw in keywords):
            return category, strategy

    return DocumentCategory.LICENSE, "form"  # 기본값


def _build_metadata(
    category: DocumentCategory,
    strategy: str,
    filename: str,
) -> dict:
    """문서 메타데이터 생성"""
    doc_type = "form" if strategy == "form" else "law" if strategy == "article" else "guide"
    return {
        "doc_type": doc_type,
        "original_filename": filename,
        "business_type": ["cafe", "bakery", "snack"],  # F&B 공통 서식은 전체 업종에 적용
    }


def load_document(file_path: str | Path) -> list[dict]:
    """
    단일 파일을 로드하여 RAG ingest용 청크 리스트로 변환.

    반환:
        [{"source": str, "chunk_index": int, "content": str, "metadata": dict, "category": str}]
    """
    path = Path(file_path)
    filename = path.name
    suffix = path.suffix.lower()

    category, strategy = _detect_category_and_strategy(filename)

    # 파일 파싱
    if suffix == ".pdf":
        text = parse_pdf(path)
        chunk_fn = _CHUNK_FN.get(strategy, chunk_by_form_section)
    elif suffix in (".md", ".txt"):
        text = parse_markdown(path)
        # 마크다운은 헤더 기반 청킹 우선, 단 법령 원문 md는 article 유지
        chunk_fn = _CHUNK_FN["md"] if suffix == ".md" and strategy != "article" else _CHUNK_FN.get(strategy, chunk_by_form_section)
    else:
        raise ValueError(f"지원하지 않는 파일 형식입니다: {suffix} ({filename})")

    chunks = chunk_fn(text)
    metadata = _build_metadata(category, strategy, filename)
    source_name = path.stem  # 확장자 제외 파일명

    return [
        {
            "source": source_name,
            "chunk_index": i,
            "content": chunk,
            "metadata": metadata,
            "category": category,
        }
        for i, chunk in enumerate(chunks)
        if chunk.strip()
    ]


def load_docs_folder(docs_dir: str | Path = "docs") -> list[dict]:
    """
    docs/ 폴더 안의 모든 지원 파일(.pdf, .md, .txt)을 로드.

    반환:
        카테고리별로 그룹화된 청크 리스트
    """
    docs_path = Path(docs_dir)
    if not docs_path.exists():
        raise FileNotFoundError(f"docs 폴더를 찾을 수 없습니다: {docs_path.resolve()}")

    supported = {".pdf", ".md", ".txt"}
    all_chunks: list[dict] = []

    for file_path in sorted(docs_path.iterdir()):
        if file_path.suffix.lower() not in supported:
            continue
        chunks = load_document(file_path)
        all_chunks.extend(chunks)
        print(f"  [{file_path.name}] → {len(chunks)}청크 / 카테고리: {chunks[0]['category'] if chunks else '-'}")

    return all_chunks
