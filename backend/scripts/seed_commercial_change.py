"""
마포구 상권변화지표 CSV 데이터를 RAG(documents 테이블)에 삽입하는 스크립트.

사전 준비:
  1. 서울 열린데이터광장(data.seoul.go.kr) 에서 CSV 다운로드
     검색어: "서울시 우리마을가게 상권분석서비스 상권변화지표"
  2. 다운로드한 CSV 파일을 아래 디렉토리에 저장:
     backend/data/seeds/commercial_change/

실행 방법 (프로젝트 루트에서):
    python -m backend.scripts.seed_commercial_change

동작:
  - commercial_change 디렉토리의 모든 CSV 파일을 파싱
  - 마포구 9개 상권만 필터링
  - category='mapo_commercial_change' 로 documents 테이블에 삽입
  - 기존 mapo_commercial_change 데이터 전체 삭제 후 재삽입
"""
import asyncio
from pathlib import Path

from backend.core.constants import DocumentCategory
from backend.db.client import get_supabase
from backend.rag.ingest import ingest_documents

CSV_DIR = Path(__file__).parent.parent / "data" / "seeds" / "commercial_change"


async def main() -> None:
    from backend.data.parsers.commercial_change_parser import load_all_from_dir

    print(f"[seed] CSV 디렉토리: {CSV_DIR}")

    supported = [f for f in CSV_DIR.iterdir() if f.suffix.lower() in (".xls", ".csv", ".xml")] if CSV_DIR.exists() else []
    if not supported:
        print("[seed] FAIL 파일 없음")
        print(f"       {CSV_DIR} 에 파일을 넣고 다시 실행하세요.")
        print()
        print("  [다운로드 방법]")
        print("  1. data.seoul.go.kr 접속")
        print("  2. 검색: '서울시 우리마을가게 상권분석서비스 상권변화지표'")
        print("  3. 파일 다운로드(.xls/.csv) -> backend/data/seeds/commercial_change/ 에 저장")
        return

    print(f"[seed] 파일 {len(supported)}개 발견: {[f.name for f in supported]}")

    all_docs = load_all_from_dir(CSV_DIR)
    if not all_docs:
        print("[seed] FAIL 마포구 데이터 없음 - CSV 내용을 확인하세요")
        return

    print(f"[seed] 총 {len(all_docs)}개 청크 추출 완료")

    # 기존 mapo_commercial_change 데이터 전체 삭제
    supabase = get_supabase()
    supabase.table("documents") \
        .delete() \
        .eq("category", DocumentCategory.MAPO_COMMERCIAL_CHANGE) \
        .execute()
    print("[seed] 기존 mapo_commercial_change 데이터 삭제 완료")

    count = await ingest_documents(all_docs, DocumentCategory.MAPO_COMMERCIAL_CHANGE)
    print(f"[seed] OK {count}개 청크 저장 완료")

    # 저장된 상권-분기 목록 출력
    quarters = sorted({d["metadata"]["quarter"] for d in all_docs})
    areas = sorted({d["metadata"]["area"] for d in all_docs})
    print(f"[seed] 분기 범위: {quarters[0]} ~ {quarters[-1]} ({len(quarters)}개 분기)")
    print(f"[seed] 마포구 상권 ({len(areas)}개): {', '.join(areas)}")


if __name__ == "__main__":
    asyncio.run(main())
