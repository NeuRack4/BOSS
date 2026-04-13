"""
지원사업 에이전트
- 기업마당 공고 수집 (마포구 카페 필터)
- 업종/지역/단계 매칭
- 신청서 초안 생성 (Claude API)
"""
import anthropic
from backend.core.config import get_settings
from backend.core.constants import LEGAL_DISCLAIMER, BusinessType
from backend.rag.retriever.pgvector_retriever import retrieve


_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 창업자를 돕는 지원사업 전문 AI 비서입니다.
주어진 지원사업 공고를 바탕으로 창업자에게 맞춤형 신청서 초안을 작성합니다.
항상 초안 형태로 제공하고, 창업자가 수정 후 제출할 수 있도록 안내하세요.
"""


async def run(ctx) -> dict:
    """지원사업 에이전트 메인 실행"""
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    # RAG: 마포구 카페 관련 지원사업 문서 검색
    docs = await retrieve(
        query=f"마포구 카페 소상공인 지원사업 창업",
        category="subsidy",
        match_count=5,
    )
    context = "\n\n".join(d["content"] for d in docs)

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"다음 지원사업 정보를 바탕으로 창업자 신청서 초안을 작성해주세요.\n\n"
                    f"[지원사업 정보]\n{context}\n\n"
                    f"[창업자 정보]\n업종: 카페, 지역: 마포구"
                ),
            }
        ],
    )

    draft_content = message.content[0].text
    draft_content += f"\n\n---\n{LEGAL_DISCLAIMER}"

    return {"agent": "subsidy", "draft": draft_content, "sources": docs}


async def match_programs(user_id: str) -> list[dict]:
    """기업마당 공고와 창업자를 매칭 후 subsidy_matches 테이블에 저장"""
    from backend.data.crawlers.bizinfo import fetch_programs
    from backend.db.client import get_supabase

    programs = await fetch_programs(
        business_type=BusinessType.CAFE,
        region="마포구",
    )

    supabase = get_supabase()
    rows = [
        {
            "user_id": user_id,
            "program_id": p["id"],
            "score": p.get("score", 0.0),
            "deadline": p.get("deadline"),
            "status": "pending",
        }
        for p in programs
    ]

    if rows:
        supabase.table("subsidy_matches").upsert(rows).execute()

    return programs
