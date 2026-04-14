"""
지원사업 공고 임베딩 CLI.

실행 (프로젝트 루트):
    # 전체 재임베딩 (기존 subsidy_program 청크 삭제 후 재삽입)
    python -m backend.scripts.ingest_subsidies

    # 증분만 (embedded_at IS NULL 인 것만)
    python -m backend.scripts.ingest_subsidies --incremental
"""
import argparse
import asyncio

from backend.rag.subsidy_ingest import ingest_programs


async def _run(incremental: bool) -> None:
    count = await ingest_programs(only_unembedded=incremental)
    print(f"[ingest_subsidies] 완료: {count}개 청크")


def main() -> None:
    parser = argparse.ArgumentParser(description="지원사업 공고 임베딩")
    parser.add_argument("--incremental", action="store_true", help="embedded_at IS NULL 인 것만 처리")
    args = parser.parse_args()
    asyncio.run(_run(args.incremental))


if __name__ == "__main__":
    main()
