"""
소상공인 전략 가이드 문서를 Supabase documents 테이블에 수집하는 스크립트.

category='strategy' 로 저장. 인사이트 분석 시 매출 상황별 전략 근거로 활용.

실행 방법 (프로젝트 루트에서):
    python -m backend.scripts.seed_strategy

PDF 준비 방법:
    docs/strategy/ 폴더에 PDF/TXT/MD 파일을 넣고 실행.

    권장 수집 문서:
    1. 소상공인시장진흥공단 카페 경영 가이드북
       https://www.semas.or.kr → 정보마당 → 통계/연구/간행물
    2. 소상공인 업종별 경영 매뉴얼 (외식업)
       https://www.semas.or.kr → 정보마당 → 경영지원
    3. 창업진흥원 외식업 창업 실패 요인 분석
       https://www.kised.or.kr → 연구자료실
    4. 서울시 자영업지원센터 경영 실태 분석
       https://www.seoulsbdc.or.kr → 자료실
    5. 중소벤처기업부 소상공인 실태조사
       https://www.mss.go.kr → 정책자료

청킹 전략:
    ## 헤더 단위 (마크다운) 또는 소제목 단위 (PDF)
    1 전략 항목 = 1 청크

metadata 예시:
    {
        "situation": "sales_down",  # sales_down / sales_up / seasonal / general
        "action_type": "menu",       # menu / marketing / cost / operation / product
        "source_org": "소상공인시장진흥공단",
        "file": "cafe_management_guide.pdf",
        "page": 12
    }
"""

import asyncio
import re
from pathlib import Path

STRATEGY_DIR = Path(__file__).parent.parent.parent / "docs" / "strategy"

# 파일명 → (기관명, situation 힌트)
_SOURCE_META: dict[str, dict] = {
    "cafe_management": {"source_org": "소상공인시장진흥공단", "situation": "general"},
    "sales_recovery": {"source_org": "소상공인시장진흥공단", "situation": "sales_down"},
    "startup_failure": {"source_org": "창업진흥원", "situation": "general"},
    "seoul_sbdc":      {"source_org": "서울시 자영업지원센터", "situation": "general"},
    "smes_survey":     {"source_org": "중소벤처기업부", "situation": "general"},
}

# 매출 하락/상승 상황 키워드 감지 (청크별 자동 태깅)
_SITUATION_KEYWORDS = {
    "sales_down": ["매출 하락", "매출 감소", "비수기", "위기", "하락", "감소", "부진", "침체"],
    "sales_up":   ["매출 증가", "성장", "상승", "호황", "피크", "성수기"],
    "seasonal":   ["계절", "여름", "겨울", "봄", "가을", "명절", "연휴"],
}

_ACTION_KEYWORDS = {
    "menu":      ["메뉴", "신메뉴", "계절 메뉴", "음료", "원가"],
    "marketing": ["마케팅", "홍보", "SNS", "인스타", "광고", "이벤트", "쿠폰"],
    "cost":      ["원가", "비용 절감", "고정비", "임대료", "인건비"],
    "operation": ["운영", "시간", "요일", "직원", "알바", "효율"],
    "product":   ["상품", "제품", "브랜드", "차별화", "콘셉트"],
}


def _detect_situation(text: str) -> str:
    text_lower = text
    for situation, keywords in _SITUATION_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return situation
    return "general"


def _detect_action_type(text: str) -> str:
    for action_type, keywords in _ACTION_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return action_type
    return "general"


def _get_source_meta(filename: str) -> dict:
    stem = Path(filename).stem.lower()
    for key, meta in _SOURCE_META.items():
        if key in stem:
            return meta
    return {"source_org": "소상공인 가이드", "situation": "general"}


def _chunk_strategy_text(text: str) -> list[str]:
    """전략 문서를 소제목(##) 또는 단락 단위로 청킹."""
    from backend.data.parsers.pdf_parser import chunk_by_markdown_heading

    # ## 헤더 기준 청킹 시도
    chunks = chunk_by_markdown_heading(text)

    # 헤더가 없거나 청크가 너무 적으면 단락 단위
    if len(chunks) < 3:
        raw_chunks = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 100]
        if raw_chunks:
            chunks = raw_chunks

    # 너무 짧은 청크 제거 (100자 미만)
    return [c for c in chunks if len(c) >= 100]


async def main() -> None:
    from backend.core.constants import DocumentCategory
    from backend.rag.ingest import ingest_documents
    from backend.data.parsers.pdf_parser import parse_pdf
    from backend.db.client import get_supabase

    if not STRATEGY_DIR.exists():
        STRATEGY_DIR.mkdir(parents=True, exist_ok=True)
        print(f"[seed_strategy] 폴더 생성: {STRATEGY_DIR}")
        print("[seed_strategy] docs/strategy/ 에 PDF/TXT/MD 파일을 넣고 다시 실행하세요.")
        _print_download_guide()
        return

    # 지원 파일 목록 수집
    files: list[Path] = []
    for ext in ("*.pdf", "*.txt", "*.md"):
        files.extend(STRATEGY_DIR.glob(ext))

    if not files:
        print(f"[seed_strategy] docs/strategy/ 에 파일이 없습니다.")
        _print_download_guide()
        return

    print(f"[seed_strategy] 파일 {len(files)}개 발견: {[f.name for f in files]}")

    # 기존 strategy 카테고리 삭제 (멱등성)
    db = get_supabase()
    db.table("documents").delete().eq("category", "strategy").execute()
    print("[seed_strategy] 기존 strategy 데이터 삭제 완료")

    total_chunks = 0
    for file in files:
        print(f"\n[seed_strategy] 처리 중: {file.name}")

        # 텍스트 추출 — Windows 한글 파일명 인코딩 이슈 우회: bytes로 읽어 BytesIO 전달
        if file.suffix == ".pdf":
            try:
                import io, pdfplumber
                with open(file, "rb") as fh:
                    raw = fh.read()
                text_parts = []
                with pdfplumber.open(io.BytesIO(raw)) as pdf:
                    for page in pdf.pages:
                        t = page.extract_text()
                        if t:
                            text_parts.append(t)
                text = "\n\n".join(text_parts)
            except Exception as e:
                print(f"  PDF 파싱 실패: {e}")
                continue
        else:
            text = file.read_text(encoding="utf-8", errors="ignore")

        if not text.strip():
            print(f"  텍스트 추출 결과 없음, 건너뜀")
            continue

        chunks = _chunk_strategy_text(text)
        print(f"  청크 수: {len(chunks)}")

        if not chunks:
            continue

        src_meta = _get_source_meta(file.name)
        documents = []
        for i, chunk in enumerate(chunks):
            metadata = {
                "situation": _detect_situation(chunk),
                "action_type": _detect_action_type(chunk),
                "source_org": src_meta["source_org"],
                "file": file.name,
            }
            documents.append(
                {
                    "source": src_meta["source_org"],
                    "chunk_index": i,
                    "content": chunk,
                    "metadata": metadata,
                }
            )

        saved = await ingest_documents(documents, DocumentCategory.STRATEGY)
        total_chunks += saved
        print(f"  {saved}개 청크 저장 완료")

    print(f"\n[seed_strategy] 완료 - strategy 카테고리 총 {total_chunks}개 청크")


def _print_download_guide() -> None:
    print("""
권장 다운로드 목록:
  1. 소상공인시장진흥공단 → 정보마당 → 경영지원/간행물
     파일명 예시: cafe_management.pdf
  2. 창업진흥원 → 연구자료실
     파일명 예시: startup_failure.pdf
  3. 서울시 자영업지원센터 → 자료실
     파일명 예시: seoul_sbdc.pdf

docs/strategy/ 에 저장 후:
  python -m backend.scripts.seed_strategy
""")


if __name__ == "__main__":
    asyncio.run(main())
