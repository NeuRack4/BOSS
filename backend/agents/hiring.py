"""
채용/서류 에이전트
- 채용공고 초안 생성 (알바/정규직)
- 근로계약서 초안 생성 (표준 양식 기반)
- 주휴수당 / 최저임금 계산
"""
from datetime import date
import anthropic
from backend.core.config import get_settings
from backend.core.constants import LEGAL_DISCLAIMER
from backend.rag.retriever.pgvector_retriever import retrieve


_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 창업자를 위한 채용 및 노무 AI 비서입니다.
표준 근로계약서 양식을 기반으로 초안을 작성하며, 최저임금과 주휴수당을 정확하게 계산합니다.
모든 법률 관련 내용에는 면책 고지를 포함합니다.
"""

# 2025년 최저임금 (시간급) — 연 1회 갱신
MIN_WAGE_2025 = 10_030  # 원/시간


def calc_weekly_holiday_pay(hourly_wage: int, weekly_hours: float) -> int:
    """주휴수당 계산 (주 15시간 이상 근무 시 발생)"""
    if weekly_hours < 15:
        return 0
    daily_wage = hourly_wage * (weekly_hours / 5)
    return int(daily_wage)


async def run(ctx) -> dict:
    """채용/서류 에이전트 메인 실행"""
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    docs = await retrieve(
        query="표준 근로계약서 카페 아르바이트",
        category="labor",
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
                    "마포구 카페 아르바이트 채용을 위한 근로계약서 초안과 채용공고를 작성해주세요.\n\n"
                    f"[표준 근로계약서 참고 자료]\n{context}\n\n"
                    f"[참고]\n2025년 최저임금: {MIN_WAGE_2025:,}원/시간\n"
                    "주 15시간 이상 근무 시 주휴수당 발생"
                ),
            }
        ],
    )

    draft = message.content[0].text + f"\n\n---\n{LEGAL_DISCLAIMER}"
    weekly_pay = calc_weekly_holiday_pay(MIN_WAGE_2025, 20)  # 주 20시간 기준 예시

    return {
        "agent": "hiring",
        "draft": draft,
        "wage_info": {
            "min_wage_2025": MIN_WAGE_2025,
            "example_weekly_holiday_pay": weekly_pay,
            "calculated_at": str(date.today()),
        },
    }
