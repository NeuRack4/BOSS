"""
PDF 파싱 + 청킹 유틸리티
- 법령 문서:  조항(제N조) 단위 청킹
- 서식 문서:  ■ 섹션 단위 청킹 (사업자등록 신청서, 영업신고서 등)
- 절차 안내:  단계(①②③) 단위 청킹
- 마크다운:   ## 헤더 단위 청킹
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


def parse_markdown(path: str | Path) -> str:
    """마크다운 파일 텍스트 추출"""
    return Path(path).read_text(encoding="utf-8")


def chunk_by_article(text: str) -> list[str]:
    """
    법령 문서를 조항(제N조) 단위로 청킹.
    조항이 없으면 단락 단위로 분리.
    """
    pattern = r"(제\s*\d+\s*조[\s\S]*?)(?=제\s*\d+\s*조|$)"
    articles = re.findall(pattern, text)

    if articles:
        return [a.strip() for a in articles if a.strip()]

    return [p.strip() for p in text.split("\n\n") if p.strip()]


def chunk_by_form_section(text: str) -> list[str]:
    """
    정부 표준서식을 섹션(■) 단위로 청킹.
    사업자등록 신청서, 식품영업 신고서 등에 사용.
    섹션 구분자: ■, ▣, ◆, ━━━ 구분선, 또는 '## 헤더'
    """
    # ■ 기호로 시작하는 섹션 분리
    section_pattern = r"(■[\s\S]*?)(?=■|$)"
    sections = re.findall(section_pattern, text)

    if sections and len(sections) >= 2:
        return [s.strip() for s in sections if s.strip()]

    # ■ 없으면 --- 구분선으로 분리
    parts = re.split(r"\n-{3,}\n", text)
    if len(parts) >= 2:
        return [p.strip() for p in parts if p.strip()]

    # 위 둘 다 없으면 단락 단위
    return [p.strip() for p in text.split("\n\n") if p.strip()]


def chunk_by_markdown_heading(text: str) -> list[str]:
    """
    마크다운 문서를 ## 헤더 단위로 청킹.
    각 섹션 = 헤더 + 본문 전체.
    """
    # ## 또는 ### 헤더 기준 분리 (# 최상위 헤더는 제목으로 스킵)
    pattern = r"(#{2,3}\s+.+[\s\S]*?)(?=#{2,3}\s+|$)"
    sections = re.findall(pattern, text)

    if sections:
        return [s.strip() for s in sections if s.strip()]

    # 헤더 없으면 ---- 구분선 기준
    parts = re.split(r"\n-{3,}\n", text)
    return [p.strip() for p in parts if p.strip()]


def chunk_by_step(text: str) -> list[str]:
    """절차 안내 문서를 단계(①②③ 또는 1. 2. 3.) 단위로 청킹"""
    pattern = r"([①-⑳]|[1-9]\.\s)[\s\S]*?(?=[①-⑳]|[1-9]\.\s|$)"
    steps = re.findall(pattern, text)

    if steps:
        return [s.strip() for s in steps if s.strip()]

    return chunk_by_article(text)
