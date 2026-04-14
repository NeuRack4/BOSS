"""
지원사업 공고 임베딩 파이프라인.

subsidy_programs(DB)의 title + description 등 핵심 필드를 BGE-M3 로 임베딩해
subsidy_programs.embedding 컬럼에 직접 저장.

증분:
  only_unembedded=True  : embedded_at IS NULL 인 행만 처리
  only_unembedded=False : 전체 재임베딩
"""
from datetime import datetime, timezone

from backend.db.client import get_supabase
from backend.rag.embeddings.bge_embeddings import embed


def _build_content(program: dict) -> str:
    parts = [f"[제목] {program.get('title', '')}"]
    if program.get("program_kind"):
        line = f"[공고 분야] {program['program_kind']}"
        if program.get("sub_kind"):
            line += f" > {program['sub_kind']}"
        parts.append(line)
    if program.get("target"):
        parts.append(f"[지원 대상] {program['target']}")
    if program.get("region"):
        parts.append(f"[지역] {program['region']}")
    if program.get("organization"):
        parts.append(f"[주관] {program['organization']}")
    if program.get("period_raw"):
        parts.append(f"[접수 기간] {program['period_raw']}")
    elif program.get("start_date") and program.get("end_date"):
        parts.append(f"[접수 기간] {program['start_date']} ~ {program['end_date']}")
    if program.get("hashtags"):
        parts.append(f"[태그] {program['hashtags']}")
    if program.get("description"):
        parts.append(f"[내용] {program['description']}")
    return "\n".join(parts)


async def ingest_programs(only_unembedded: bool = False, batch_size: int = 8) -> int:
    supabase = get_supabase()

    query = supabase.table("subsidy_programs").select(
        "id, external_id, title, organization, region, program_kind, sub_kind, "
        "target, start_date, end_date, period_raw, is_ongoing, description, hashtags"
    )
    if only_unembedded:
        query = query.is_("embedded_at", "null")

    result = query.execute()
    programs: list[dict] = result.data or []

    if not programs:
        print("[subsidy-ingest] 처리 대상 없음")
        return 0

    print(f"[subsidy-ingest] {len(programs)}건 임베딩 시작")

    total = 0
    for i in range(0, len(programs), batch_size):
        batch = programs[i : i + batch_size]
        contents = [_build_content(p) for p in batch]
        vectors = await embed(contents)

        now_iso = datetime.now(timezone.utc).isoformat()
        for program, vec in zip(batch, vectors):
            supabase.table("subsidy_programs").update(
                {
                    "embedding": vec,
                    "embedded_at": now_iso,
                }
            ).eq("id", program["id"]).execute()
            total += 1
        print(f"[subsidy-ingest] {total}/{len(programs)} 저장 완료")

    print(f"[subsidy-ingest] 완료 - {total}개 프로그램 임베딩")
    return total
