"""
전체 법령 데이터를 law_chunks 테이블에 수집하는 CLI 스크립트.

실행 방법 (프로젝트 루트에서):
    # 전체 카테고리 재수집 (기존 데이터 초기화 후 삽입)
    python -m backend.scripts.ingest_laws

    # 특정 카테고리만
    python -m backend.scripts.ingest_laws --category license
    python -m backend.scripts.ingest_laws --category regulation
    python -m backend.scripts.ingest_laws --category tax
    python -m backend.scripts.ingest_laws --category labor
    python -m backend.scripts.ingest_laws --category lease
    python -m backend.scripts.ingest_laws --category subsidy

카테고리별 수집 법령:
    license     식품위생법, 소방시설법, 건축법
    regulation  개인정보보호법
    tax         부가가치세법, 소득세법, 국세기본법, 조세특례제한법
    labor       근로기준법, 최저임금법, 퇴직급여법, 고용보험법, 산재보험법
    lease       상가건물 임대차보호법
    subsidy     소상공인 보호법, 중소기업창업 지원법
"""
import argparse
import asyncio

CATEGORY_FN_MAP = {
    "license":    "ingest_licenses",
    "regulation": "ingest_regulations",
    "tax":        "ingest_tax_laws",
    "labor":      "ingest_labor_laws",
    "lease":      "ingest_lease_laws",
    "subsidy":    "ingest_subsidy_laws",
}


async def run(category: str | None) -> None:
    from backend.rag.ingest import (
        ingest_all_laws,
        ingest_licenses,
        ingest_regulations,
        ingest_tax_laws,
        ingest_labor_laws,
        ingest_lease_laws,
        ingest_subsidy_laws,
    )
    from backend.db.client import get_supabase

    fn_map = {
        "license":    ingest_licenses,
        "regulation": ingest_regulations,
        "tax":        ingest_tax_laws,
        "labor":      ingest_labor_laws,
        "lease":      ingest_lease_laws,
        "subsidy":    ingest_subsidy_laws,
    }

    if category is None:
        results = await ingest_all_laws()
        print("\n[결과 요약]")
        for cat, count in results.items():
            print(f"  {cat:12s}: {count}개")
    else:
        if category not in fn_map:
            print(f"[오류] 알 수 없는 카테고리: {category}")
            print(f"선택 가능: {', '.join(fn_map)}")
            return

        # 해당 카테고리만 삭제 후 재수집
        supabase = get_supabase()
        print(f"[ingest] law_chunks에서 {category} 기존 데이터 삭제...")
        supabase.table("law_chunks").delete().eq("category", category).execute()

        count = await fn_map[category]()
        print(f"\n[결과] {category}: {count}개 청크 저장 완료")


def main() -> None:
    parser = argparse.ArgumentParser(description="BOSS 법령 데이터 수집 CLI")
    parser.add_argument(
        "--category",
        choices=list(CATEGORY_FN_MAP.keys()),
        default=None,
        help="수집할 카테고리 (생략 시 전체 재수집)",
    )
    args = parser.parse_args()
    asyncio.run(run(args.category))


if __name__ == "__main__":
    main()
