"""
세금/일정 에이전트
- 부가세 / 종합소득세 기한 관리
- 사업자등록 · 식품위생 인허가 절차 안내
- 세금 신고서 초안 생성
"""
from datetime import date
import anthropic
from backend.core.config import get_settings
from backend.core.constants import LEGAL_DISCLAIMER
from backend.rag.retriever.pgvector_retriever import retrieve


# 2025년 기준 주요 세금 기한 (연 1회 갱신)
TAX_DEADLINES: list[dict] = [
    {"name": "부가세 1기 예정신고", "deadline": date(2025, 4, 25), "type": "vat"},
    {"name": "부가세 1기 확정신고", "deadline": date(2025, 7, 25), "type": "vat"},
    {"name": "부가세 2기 예정신고", "deadline": date(2025, 10, 25), "type": "vat"},
    {"name": "부가세 2기 확정신고", "deadline": date(2026, 1, 25), "type": "vat"},
    {"name": "종합소득세 신고", "deadline": date(2025, 5, 31), "type": "income"},
]

_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 창업자를 위한 세금·행정 AI 비서입니다.
관련 법령과 절차를 정확하게 안내하되, 모든 답변 하단에 면책 고지를 포함합니다.
"""


async def run(ctx) -> dict:
    """세금/인허가 에이전트 메인 실행"""
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    docs = await retrieve(
        query="카페 식품위생 인허가 사업자등록 절차",
        category="license",
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
                    f"마포구 카페 창업자의 현재 단계(sub_stage={ctx.sub_stage})에 맞는 "
                    f"세금·인허가 안내와 초안을 작성해주세요.\n\n"
                    f"[관련 법령 정보]\n{context}"
                ),
            }
        ],
    )

    draft = message.content[0].text + f"\n\n---\n{LEGAL_DISCLAIMER}"
    return {"agent": "tax", "draft": draft, "upcoming_deadlines": get_upcoming_deadlines()}


def get_upcoming_deadlines(days_ahead: int = 30) -> list[dict]:
    """D-days 기준으로 다가오는 세금 기한 반환"""
    today = date.today()
    result = []
    for item in TAX_DEADLINES:
        delta = (item["deadline"] - today).days
        if 0 <= delta <= days_ahead:
            result.append({**item, "d_day": delta, "deadline": str(item["deadline"])})
    return result
