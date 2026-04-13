"""
PDF 파싱 + 청킹 유틸리티
- 법령 문서: 조항(제N조) 단위 청킹
- 정부 표준서식 PDF 파싱
"""
import re
from pathlib import Path

try:
    import pdfplumber
    _PDF_AVAILABLE = True
except ImportError:
    _PDF_AVAILABLE = False


def parse_pdf(path: str | Path) -> str:
    """PDF 파일에서 텍스트 추출"""
    if not _PDF_AVAILABLE:
        raise ImportError("pdfplumber가 설치되지 않았습니다: pip install pdfplumber")

    import pdfplumber

    text_parts = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

    return "\n\n".join(text_parts)


def chunk_by_article(text: str) -> list[str]:
    """
    법령 문서를 조항(제N조) 단위로 청킹.
    조항이 없으면 단락 단위로 분리.
    """
    # 제N조 패턴으로 분리
    pattern = r"(제\s*\d+\s*조[\s\S]*?)(?=제\s*\d+\s*조|$)"
    articles = re.findall(pattern, text)

    if articles:
        return [a.strip() for a in articles if a.strip()]

    # 조항 없으면 빈 줄 단위 분리
    return [p.strip() for p in text.split("\n\n") if p.strip()]


def chunk_by_step(text: str) -> list[str]:
    """절차 안내 문서를 단계(①②③ 또는 1. 2. 3.) 단위로 청킹"""
    pattern = r"([①-⑳]|[1-9]\.\s)[\s\S]*?(?=[①-⑳]|[1-9]\.\s|$)"
    steps = re.findall(pattern, text)

    if steps:
        return [s.strip() for s in steps if s.strip()]

    return chunk_by_article(text)
